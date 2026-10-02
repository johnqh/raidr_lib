/**
 * Remembered credentials for the API playground, per API host, in the
 * browser only (localStorage). A signed-in user's site token and an
 * application key are kept separately. Nothing here is sent to raidr except
 * inside an execute request the user triggers.
 */

export type CredentialKind = 'user' | 'api_key';

export interface CredentialStore {
  get(apiHost: string, kind: CredentialKind): string | null;
  set(apiHost: string, kind: CredentialKind, value: string): void;
  clear(apiHost: string, kind: CredentialKind): void;
}

/** Minimal Storage shape, so tests and SSR can pass a fake or nothing. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const key = (apiHost: string, kind: CredentialKind) =>
  `raidr:credential:${kind}:${apiHost}`;

/** `window.localStorage` when usable (it can throw in private modes), else null. */
export function browserStorage(): KeyValueStorage | null {
  try {
    const storage = (globalThis as { localStorage?: KeyValueStorage })
      .localStorage;
    if (!storage) return null;
    storage.getItem('raidr:probe');
    return storage;
  } catch {
    return null;
  }
}

/** A store over `storage`; with no storage it remembers nothing (and never throws). */
export function createCredentialStore(
  storage: KeyValueStorage | null = browserStorage()
): CredentialStore {
  return {
    get(apiHost, kind) {
      try {
        return storage?.getItem(key(apiHost, kind)) ?? null;
      } catch {
        return null;
      }
    },
    set(apiHost, kind, value) {
      try {
        if (value === '') storage?.removeItem(key(apiHost, kind));
        else storage?.setItem(key(apiHost, kind), value);
      } catch {
        // Storage full or blocked: the value just is not remembered.
      }
    },
    clear(apiHost, kind) {
      try {
        storage?.removeItem(key(apiHost, kind));
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Open the site's sign-in page in a small window (the browser's "web view"),
 * so the user can sign in there and copy their token back. Returns the
 * window, or null when a popup blocker refused it.
 */
export function openLoginWindow(url: string): Window | null {
  const open = (
    globalThis as {
      open?: (url: string, target: string, features: string) => Window | null;
    }
  ).open;
  if (!open) return null;
  return open(url, 'raidr-login', 'popup,width=520,height=760');
}

/**
 * Call `onClosed` once the sign-in popup is closed. The site in it is another
 * origin, so its cookies and token are out of reach; closing the window is the
 * one signal raidr can see. Returns a stop function.
 */
export function watchWindowClosed(
  win: Pick<Window, 'closed'>,
  onClosed: () => void,
  intervalMs = 500
): () => void {
  const timer = globalThis.setInterval(() => {
    if (!win.closed) return;
    globalThis.clearInterval(timer);
    onClosed();
  }, intervalMs);
  return () => globalThis.clearInterval(timer);
}
