import { describe, expect, it } from 'vitest';
import type { ApiEndpoint, ApiParam } from '@sudobility/raidr_types';
import {
  buildExecute,
  coerceParam,
  paramControl,
  paramPlaceholder,
  validateParam,
} from './params';

const p = (over: Partial<ApiParam>): ApiParam => ({
  name: 'x',
  in: 'query',
  type: 'string',
  required: false,
  ...over,
});

describe('paramControl', () => {
  it('picks a control per type', () => {
    expect(paramControl(p({ type: 'enum', enum: ['a', 'b'] }))).toEqual({
      kind: 'select',
      options: ['a', 'b'],
      allowOther: false,
    });
    expect(
      paramControl(p({ type: 'enum', enum: ['a'], enumExhaustive: false }))
    ).toMatchObject({ allowOther: true });
    expect(paramControl(p({ type: 'integer' }))).toEqual({
      kind: 'number',
      integer: true,
    });
    expect(paramControl(p({ type: 'boolean' }))).toEqual({ kind: 'switch' });
    expect(paramControl(p({ type: 'object' }))).toEqual({ kind: 'json' });
    expect(paramControl(p({ type: 'array', itemType: 'string' }))).toEqual({
      kind: 'list',
    });
    expect(paramControl(p({ type: 'array', itemType: 'object' }))).toEqual({
      kind: 'json',
    });
    expect(paramControl(p({ format: 'email' }))).toEqual({
      kind: 'text',
      inputType: 'email',
    });
  });
});

describe('validateParam', () => {
  it('empty is fine unless required', () => {
    expect(validateParam(p({}), '')).toBeNull();
    expect(validateParam(p({ required: true }), '')).toBe('Required');
  });
  it('numbers, ranges and booleans', () => {
    expect(validateParam(p({ type: 'integer' }), '1.5')).toBe(
      'Enter a whole number'
    );
    expect(
      validateParam(p({ type: 'integer', minimum: 1, maximum: 50 }), '100')
    ).toBe('Must be at most 50');
    expect(validateParam(p({ type: 'number' }), 'abc')).toBe('Enter a number');
    expect(validateParam(p({ type: 'number' }), '2.5')).toBeNull();
    expect(validateParam(p({ type: 'boolean' }), 'yes')).toBe(
      'Choose true or false'
    );
  });
  it('formats, length and pattern', () => {
    expect(validateParam(p({ format: 'uuid' }), 'nope')).toMatch(/UUID/);
    expect(
      validateParam(
        p({ format: 'uuid' }),
        '3f1c9a3e-1b2d-4c5e-9f00-112233445566'
      )
    ).toBeNull();
    expect(validateParam(p({ format: 'email' }), 'a@b')).toMatch(/email/);
    expect(validateParam(p({ format: 'uri' }), 'example.com')).toMatch(/URL/);
    expect(validateParam(p({ format: 'date' }), '2026-10-02')).toBeNull();
    expect(validateParam(p({ maxLength: 3 }), 'abcd')).toBe(
      'At most 3 characters'
    );
    expect(validateParam(p({ pattern: '^[a-z]+$' }), 'ABC')).toBe(
      'Does not match the expected format'
    );
    expect(validateParam(p({ pattern: '([' }), 'x')).toBeNull(); // a broken pattern never blocks
  });
  it('enums: closed sets reject other values, open ones accept them', () => {
    expect(
      validateParam(p({ type: 'enum', enum: ['new', 'top'] }), 'hot')
    ).toBe('Choose one of: new, top');
    expect(
      validateParam(
        p({ type: 'enum', enum: ['new', 'top'], enumExhaustive: false }),
        'hot'
      )
    ).toBeNull();
  });
  it('JSON and lists', () => {
    expect(validateParam(p({ type: 'object' }), '[1]')).toMatch(/JSON object/);
    expect(validateParam(p({ type: 'object' }), '{"a":1}')).toBeNull();
    expect(
      validateParam(p({ type: 'array', itemType: 'integer' }), '1, x')
    ).toBe('"x": Enter a whole number');
  });
});

describe('coerceParam', () => {
  it('turns text into typed values', () => {
    expect(coerceParam(p({ type: 'integer' }), '42')).toBe(42);
    expect(coerceParam(p({ type: 'boolean' }), 'false')).toBe(false);
    expect(
      coerceParam(p({ type: 'array', itemType: 'number' }), '1, 2.5,')
    ).toEqual([1, 2.5]);
    expect(coerceParam(p({ type: 'object' }), '{"a":1}')).toEqual({ a: 1 });
    expect(coerceParam(p({}), '')).toBeUndefined();
  });
  it('placeholders come from examples', () => {
    expect(paramPlaceholder(p({ example: 20 }))).toBe('20');
    expect(paramPlaceholder(p({ format: 'uuid' }))).toMatch(/^0{8}-/);
  });
});

describe('buildExecute', () => {
  const endpoint: ApiEndpoint = {
    id: 'POST /v1/clips/{clip_id}/like',
    method: 'POST',
    path: '/v1/clips/{clip_id}/like',
    summary: 'Like',
    auth: 'user',
    params: [
      { name: 'clip_id', in: 'path', type: 'string', required: true },
      { name: 'count', in: 'body', type: 'integer', required: false },
    ],
    body: 'json',
    additionalBody: true,
    responses: [],
  };
  it('reports every error at once', () => {
    const built = buildExecute(endpoint, { count: 'x' }, '{bad', {
      userToken: 't',
    });
    expect(built.request).toBeNull();
    expect(built.errors).toEqual({
      clip_id: 'Required',
      count: 'Enter a whole number',
      extraBody: 'Enter valid JSON',
    });
  });
  it('builds a typed request with only the credential the endpoint needs', () => {
    const built = buildExecute(
      endpoint,
      { clip_id: 'c1', count: '3' },
      '{"note":"hi"}',
      { userToken: 't', apiKey: 'k' }
    );
    expect(built.request).toEqual({
      endpointId: endpoint.id,
      params: { clip_id: 'c1', count: 3 },
      extraBody: { note: 'hi' },
      userToken: 't',
    });
  });
});
