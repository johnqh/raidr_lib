import { describe, expect, it, vi } from 'vitest';
import {
  createCredentialStore,
  type KeyValueStorage,
  watchWindowClosed,
} from './credentials';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: k => void data.delete(k),
  };
}

describe('createCredentialStore', () => {
  it('keeps user tokens and API keys per host', () => {
    const storage = memory();
    const store = createCredentialStore(storage);
    store.set('api.suno.com', 'user', 'tok');
    store.set('api.suno.com', 'api_key', 'key');
    store.set('api.udio.com', 'user', 'other');
    expect(store.get('api.suno.com', 'user')).toBe('tok');
    expect(store.get('api.suno.com', 'api_key')).toBe('key');
    expect(store.get('api.udio.com', 'user')).toBe('other');
    store.set('api.suno.com', 'user', '');
    expect(store.get('api.suno.com', 'user')).toBeNull();
    store.clear('api.suno.com', 'api_key');
    expect(storage.data.size).toBe(1);
  });
  it('never throws when storage is missing or blocked', () => {
    expect(createCredentialStore(null).get('h', 'user')).toBeNull();
    const blocked: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const store = createCredentialStore(blocked);
    expect(() => store.set('h', 'user', 'x')).not.toThrow();
    expect(store.get('h', 'user')).toBeNull();
  });
});

describe('watchWindowClosed', () => {
  it('fires once when the popup closes, and not after stop', () => {
    vi.useFakeTimers();
    try {
      const win = { closed: false };
      const onClosed = vi.fn();
      watchWindowClosed(win, onClosed, 100);
      vi.advanceTimersByTime(300);
      expect(onClosed).not.toHaveBeenCalled();
      win.closed = true;
      vi.advanceTimersByTime(500);
      expect(onClosed).toHaveBeenCalledTimes(1);

      const other = { closed: false };
      const never = vi.fn();
      const stop = watchWindowClosed(other, never, 100);
      stop();
      other.closed = true;
      vi.advanceTimersByTime(500);
      expect(never).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
