/**
 * raidr.app's side of the raidr browser extension bridge. The extension's
 * content script listens on the page's own window; this posts requests there
 * and resolves on its answers (protocol in `@sudobility/raidr_types`).
 *
 * `detect` answers whether the extension is installed. `requestToken` asks it
 * to open the site's sign-in page and resolves with the site token once the
 * user is signed in, so nobody has to copy a token by hand.
 */
import {
  type BridgeRequest,
  type BridgeResponse,
  type CapturedCredential,
  isBridgeResponse,
  RAIDR_BRIDGE_APP,
  type TokenRequest,
} from '@sudobility/raidr_types';

/** The slice of `window` the bridge uses; injected in tests. */
export interface BridgeWindow {
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown; source?: unknown }) => void
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: { data: unknown; source?: unknown }) => void
  ): void;
  location: { origin: string };
}

export type TokenFailure = 'closed' | 'blocked' | 'error';

export class TokenRequestError extends Error {
  constructor(
    readonly reason: TokenFailure,
    message?: string
  ) {
    super(message ?? `Sign-in ${reason}`);
    this.name = 'TokenRequestError';
  }
}

export interface ExtensionBridge {
  /** The extension's version, or null when it does not answer in time. */
  detect(timeoutMs?: number): Promise<string | null>;
  requestToken(
    request: TokenRequest,
    handlers?: { onOpened?: () => void }
  ): { result: Promise<CapturedCredential>; cancel: () => void };
}

let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function browserWindow(): BridgeWindow | null {
  const w = (globalThis as { window?: BridgeWindow }).window;
  return w && typeof w.postMessage === 'function' ? w : null;
}

export function createExtensionBridge(
  win: BridgeWindow | null = browserWindow()
): ExtensionBridge {
  const post = (message: BridgeRequest) =>
    win?.postMessage(message, win.location.origin);

  /** Calls `onMessage` for this request id's answers until `stop` runs. */
  const listen = (id: string, onMessage: (r: BridgeResponse) => void) => {
    const listener = (event: { data: unknown; source?: unknown }) => {
      if (event.source !== undefined && event.source !== win) return;
      if (isBridgeResponse(event.data) && event.data.id === id)
        onMessage(event.data);
    };
    win?.addEventListener('message', listener);
    return () => win?.removeEventListener('message', listener);
  };

  return {
    detect(timeoutMs = 500) {
      if (!win) return Promise.resolve(null);
      const id = nextId();
      return new Promise(resolve => {
        const stop = listen(id, response => {
          if (response.type !== 'pong') return;
          globalThis.clearTimeout(timer);
          stop();
          resolve(response.version);
        });
        const timer = globalThis.setTimeout(() => {
          stop();
          resolve(null);
        }, timeoutMs);
        post({ source: RAIDR_BRIDGE_APP, type: 'ping', id });
      });
    },

    requestToken(request, handlers = {}) {
      const id = nextId();
      let stop: () => void = () => undefined;
      const result = new Promise<CapturedCredential>((resolve, reject) => {
        if (!win) {
          reject(new TokenRequestError('error', 'No browser window'));
          return;
        }
        stop = listen(id, response => {
          if (response.type === 'token/opened') handlers.onOpened?.();
          else if (response.type === 'token/result') {
            stop();
            resolve(response.credential);
          } else if (response.type === 'token/failed') {
            stop();
            reject(new TokenRequestError(response.reason, response.message));
          }
        });
        post({ source: RAIDR_BRIDGE_APP, type: 'token/request', id, request });
      });
      return {
        result,
        cancel: () => {
          stop();
          post({ source: RAIDR_BRIDGE_APP, type: 'token/cancel', id });
        },
      };
    },
  };
}
