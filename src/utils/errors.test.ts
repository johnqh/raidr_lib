import { describe, expect, it } from 'vitest';
import { detailState, isNotFoundError } from './errors';

class FakeNetworkError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

describe('isNotFoundError', () => {
  it('recognizes only a 404 status', () => {
    expect(isNotFoundError(new FakeNetworkError(404))).toBe(true);
    expect(isNotFoundError(new FakeNetworkError(0))).toBe(false);
    expect(isNotFoundError(new FakeNetworkError(500))).toBe(false);
    expect(isNotFoundError(new Error('x'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});

describe('detailState', () => {
  const base = {
    isLoading: false,
    error: null,
    data: undefined,
    enabled: true,
  };
  it('treats a 404 as not found', () => {
    expect(detailState({ ...base, error: new FakeNetworkError(404) })).toEqual({
      notFound: true,
      error: null,
    });
  });
  it('treats an unreachable API as an error, not a missing record', () => {
    const error = new FakeNetworkError(0);
    expect(detailState({ ...base, error })).toEqual({ notFound: false, error });
  });
  it('is neither while loading, and found on success', () => {
    expect(detailState({ ...base, isLoading: true })).toEqual({
      notFound: false,
      error: null,
    });
    expect(detailState({ ...base, data: { success: true } })).toEqual({
      notFound: false,
      error: null,
    });
  });
  it('is not found when disabled', () => {
    expect(detailState({ ...base, enabled: false })).toEqual({
      notFound: true,
      error: null,
    });
  });
});
