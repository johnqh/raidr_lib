import type { RedactionEntry, RedactionKind } from '../bundle/types';

export type Pseudonymizer = (kind: RedactionKind, value: string) => string;

const LABELS: Record<RedactionKind, string> = {
  jwt: 'JWT',
  bearer: 'BEARER',
  cookie: 'COOKIE',
  'api-key': 'API_KEY',
  session: 'SESSION',
  password: 'PASSWORD',
  email: 'EMAIL',
  phone: 'PHONE',
  'high-entropy': 'SECRET',
};

/**
 * FNV-1a, 32-bit. Synchronous by design: redaction runs inline on every
 * captured body, and an async digest per field would serialize the capture
 * pipeline behind the event loop.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function createPseudonymizer(salt: string): {
  pseudonym: Pseudonymizer;
  entries(): RedactionEntry[];
} {
  const assigned = new Map<string, string>();
  const counts = new Map<string, { kind: RedactionKind; occurrences: number }>();
  let emailCounter = 0;
  let phoneCounter = 0;

  const pseudonym: Pseudonymizer = (kind, value) => {
    const key = `${kind}:${value}`;
    let placeholder = assigned.get(key);

    if (placeholder === undefined) {
      if (kind === 'email') {
        emailCounter += 1;
        placeholder = `user${emailCounter}@example.com`;
      } else if (kind === 'phone') {
        phoneCounter += 1;
        placeholder = `+1555${String(phoneCounter).padStart(7, '0')}`;
      } else {
        const digest = fnv1a(`${salt}:${value}`)
          .toString(16)
          .padStart(8, '0')
          .slice(0, 4);
        placeholder = `<${LABELS[kind]}:${digest}>`;
      }
      assigned.set(key, placeholder);
      counts.set(placeholder, { kind, occurrences: 0 });
    }

    const entry = counts.get(placeholder);
    if (entry) entry.occurrences += 1;
    return placeholder;
  };

  return {
    pseudonym,
    entries: () =>
      Array.from(counts.entries()).map(([placeholder, meta]) => ({
        placeholder,
        kind: meta.kind,
        occurrences: meta.occurrences,
      })),
  };
}
