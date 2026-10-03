import { describe, expect, it } from 'vitest';
import type { ApiEndpointV2 } from '@sudobility/raidr_types';
import { formOf } from './schemaForm';
import { buildExecute } from './params';

const endpoint = (
  body?: ApiEndpointV2['input']['properties']['body']
): ApiEndpointV2 => ({
  id: 'POST /v2/orders/{order_id}/items',
  method: 'POST',
  path: '/v2/orders/{order_id}/items',
  summary: 'Add an item',
  auth: 'user',
  bodyEncoding: 'json',
  input: {
    type: 'object',
    properties: {
      path: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            format: 'uuid',
            description: 'The order',
          },
        },
        required: ['order_id'],
      },
      query: { type: 'object', properties: { dry: { type: 'boolean' } } },
      headers: {
        type: 'object',
        properties: {
          'x-csrf': {
            type: 'string',
            description: 'CSRF token.',
            'x-raidr-header': { kind: 'cookie', key: 'csrf' },
          },
          authorization: { type: 'string', 'x-raidr-header': { kind: 'auth' } },
        },
        required: ['x-csrf'],
      },
      ...(body ? { body } : {}),
    },
  },
  responses: [],
});

describe('formOf (version 2)', () => {
  it('turns path, query, header and object-body properties into form fields', () => {
    const form = formOf(
      endpoint({
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Product' },
          qty: { type: 'integer', minimum: 1 },
          size: { type: 'string', enum: ['S', 'M'] },
          options: { type: 'array', items: { type: 'object' } },
        },
        required: ['sku'],
      })
    );
    expect(
      form.params.map(
        p => `${p.in}:${p.name}:${p.type}${p.required ? '!' : ''}`
      )
    ).toEqual([
      'path:order_id:string!',
      'query:dry:boolean',
      'header:x-csrf:string!',
      'body:sku:string!',
      'body:qty:integer',
      'body:size:enum',
      'body:options:array',
    ]);
    expect(form.params[0]!.format).toBe('uuid');
    expect(form.params[2]!.description).toBe(
      'CSRF token. The site copies it from the "csrf" cookie.'
    );
    expect(form.rawBody).toBe('extra');
  });

  it('a body that is not an object is one raw JSON editor', () => {
    expect(
      formOf(endpoint({ type: 'array', items: { type: 'string' } })).rawBody
    ).toBe('whole');
  });
});

describe('buildExecute (version 2)', () => {
  it('groups values as input and parses the whole-body editor', () => {
    const built = buildExecute(
      endpoint({ type: 'array', items: { type: 'string' } }),
      {
        order_id: '3f1c9a3e-1b2d-4c5e-9f00-112233445566',
        dry: 'true',
        'x-csrf': 't1',
      },
      '["c1","c2"]',
      { userToken: 'tok' }
    );
    expect(built.errors).toEqual({});
    expect(built.request).toEqual({
      endpointId: 'POST /v2/orders/{order_id}/items',
      params: {},
      input: {
        path: { order_id: '3f1c9a3e-1b2d-4c5e-9f00-112233445566' },
        query: { dry: true },
        headers: { 'x-csrf': 't1' },
        body: ['c1', 'c2'],
      },
      userToken: 'tok',
    });
  });

  it('merges extra fields under the form fields and reports bad JSON and missing values', () => {
    const e = endpoint({
      type: 'object',
      properties: { sku: { type: 'string' } },
      required: ['sku'],
    });
    const ok = buildExecute(
      e,
      {
        order_id: '3f1c9a3e-1b2d-4c5e-9f00-112233445566',
        'x-csrf': 't',
        sku: 'A1',
      },
      '{"note":"hi","sku":"ignored"}',
      {}
    );
    expect(ok.request?.input?.body).toEqual({ note: 'hi', sku: 'A1' });
    const bad = buildExecute(e, {}, '{oops', {});
    expect(bad.request).toBeNull();
    expect(Object.keys(bad.errors).sort()).toEqual([
      'extraBody',
      'order_id',
      'sku',
      'x-csrf',
    ]);
  });
});
