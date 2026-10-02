import { describe, expect, it } from 'vitest';
import { RAIDR_BRIDGE_EXTENSION } from '@sudobility/raidr_types';
import {
  type BridgeWindow,
  createExtensionBridge,
  TokenRequestError,
} from './extensionBridge';

/** A window whose "extension" answers with `reply`. */
function fakeWindow(
  reply: (msg: { type: string; id: string }) => unknown[] = () => []
): BridgeWindow & { sent: unknown[] } {
  const listeners = new Set<(e: { data: unknown; source?: unknown }) => void>();
  const win: BridgeWindow & { sent: unknown[] } = {
    sent: [],
    location: { origin: 'https://raidr.app' },
    postMessage(message) {
      win.sent.push(message);
      for (const r of reply(message as { type: string; id: string })) {
        globalThis.queueMicrotask(() =>
          listeners.forEach(l => l({ data: r, source: win }))
        );
      }
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  return win;
}

const REQUEST = {
  apiHost: 'api.example.com',
  loginUrl: 'https://example.com',
  auth: { style: 'bearer' as const },
  userPaths: ['/me'],
};

describe('extension bridge', () => {
  it('detects the extension by its pong, or times out', async () => {
    const present = createExtensionBridge(
      fakeWindow(m =>
        m.type === 'ping'
          ? [
              {
                source: RAIDR_BRIDGE_EXTENSION,
                type: 'pong',
                id: m.id,
                version: '0.1.0',
              },
            ]
          : []
      )
    );
    expect(await present.detect(50)).toBe('0.1.0');
    expect(await createExtensionBridge(fakeWindow()).detect(20)).toBeNull();
    expect(await createExtensionBridge(null).detect(20)).toBeNull();
  });

  it('resolves with the captured token and reports the window opening', async () => {
    let opened = false;
    const bridge = createExtensionBridge(
      fakeWindow(m =>
        m.type === 'token/request'
          ? [
              {
                source: RAIDR_BRIDGE_EXTENSION,
                type: 'token/opened',
                id: m.id,
              },
              {
                source: RAIDR_BRIDGE_EXTENSION,
                type: 'token/result',
                id: 'other',
                credential: { token: 'no', verified: true },
              },
              {
                source: RAIDR_BRIDGE_EXTENSION,
                type: 'token/result',
                id: m.id,
                credential: { token: 't', verified: true },
              },
            ]
          : []
      )
    );
    const { result } = bridge.requestToken(REQUEST, {
      onOpened: () => (opened = true),
    });
    expect(await result).toEqual({ token: 't', verified: true });
    expect(opened).toBe(true);
  });

  it('rejects with the reason when the user closes the window', async () => {
    const win = fakeWindow(m =>
      m.type === 'token/request'
        ? [
            {
              source: RAIDR_BRIDGE_EXTENSION,
              type: 'token/failed',
              id: m.id,
              reason: 'closed',
            },
          ]
        : []
    );
    const { result } = createExtensionBridge(win).requestToken(REQUEST);
    await expect(result).rejects.toBeInstanceOf(TokenRequestError);
    await expect(result).rejects.toMatchObject({ reason: 'closed' });
  });

  it('cancel tells the extension', () => {
    const win = fakeWindow();
    createExtensionBridge(win).requestToken(REQUEST).cancel();
    expect(win.sent.map(m => (m as { type: string }).type)).toEqual([
      'token/request',
      'token/cancel',
    ]);
  });
});
