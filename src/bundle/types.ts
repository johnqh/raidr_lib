export type GapReason =
  | 'body-evicted'
  | 'cors-opaque'
  | 'detached'
  | 'quota'
  | 'too-large'
  | 'cdp-error';

export type RedactionKind =
  | 'jwt'
  | 'bearer'
  | 'cookie'
  | 'api-key'
  /** A per-user credential issued by the server, not build-time config. */
  | 'session'
  | 'password'
  | 'email'
  | 'phone'
  | 'high-entropy';

/** One captured request/response pair. Bodies are referenced by SHA-256 hash. */
export interface CapturedRequest {
  /** CDP requestId, unique within a session. */
  id: string;
  /** Epoch milliseconds when the request was sent. */
  ts: number;
  method: string;
  url: string;
  /** CDP resource type: Document, Script, XHR, Fetch, Stylesheet, Image, ... */
  resourceType: string;
  requestHeaders: Record<string, string>;
  requestBodyHash: string | null;
  status: number | null;
  responseHeaders: Record<string, string>;
  responseBodyHash: string | null;
  mimeType: string | null;
  fromCache: boolean;
  /** Navigation id this request occurred under, joining requests to routes. */
  navigationId: string | null;
}

export interface CapturedFrame {
  /** CDP requestId of the WebSocket connection. */
  id: string;
  ts: number;
  direction: 'sent' | 'received';
  opcode: number;
  payloadHash: string;
}

export interface Gap {
  requestId: string;
  url: string;
  reason: GapReason;
  ts: number;
  /** Human-readable detail, e.g. the CDP error message. */
  detail: string | null;
}

export interface RedactionEntry {
  /** e.g. "<JWT:a1b2>" */
  placeholder: string;
  kind: RedactionKind;
  occurrences: number;
}

export interface StackFingerprint {
  framework: 'react' | 'vue' | 'unknown';
  frameworkVersion: string | null;
  router: string | null;
  routerVersion: string | null;
  stateLibraries: string[];
  bundler: 'webpack' | 'vite' | 'unknown';
}

export interface RaidrManifest {
  formatVersion: 1;
  sessionId: string;
  origin: string;
  startedAt: string;
  endedAt: string | null;
  counts: {
    requests: number;
    frames: number;
    bodies: number;
    gaps: number;
  };
  stack: StackFingerprint | null;
}
