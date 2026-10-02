import { describe, expect, it } from 'vitest';
import type { ApiDoc, ApiFlow } from '@sudobility/raidr_types';
import {
  assignColumns,
  buildFlowGraph,
  LOGIN_NODE_ID,
  MAX_FLOW_NODES,
} from './flow';

const ep = (
  id: string,
  summary: string,
  auth: 'none' | 'user' = 'user',
  role?: 'login'
) => {
  const [method, path] = id.split(' ');
  return {
    id,
    method,
    path,
    summary,
    auth,
    params: [],
    responses: [],
    ...(role ? { role } : {}),
  };
};

const doc = (endpoints: unknown[]): ApiDoc =>
  ({
    apiHost: 'api.shop.example',
    baseUrl: 'https://api.shop.example',
    siteOrigins: ['https://shop.example'],
    auth: { user: { style: 'bearer', loginUrl: 'https://shop.example' } },
    endpoints,
  }) as unknown as ApiDoc;

describe('buildFlowGraph', () => {
  it('Log in → Browse products → Product details, left to right', () => {
    const d = doc([
      ep('GET /v1/products', 'list products'),
      ep('GET /v1/products/{id}', 'get product'),
    ]);
    const flow: ApiFlow = {
      apiHost: d.apiHost,
      links: [
        {
          from: { apiHost: d.apiHost, endpointId: 'GET /v1/products' },
          to: { apiHost: d.apiHost, endpointId: 'GET /v1/products/{id}' },
          kind: 'data',
          evidence: 'observed',
          toParam: 'id',
        },
      ],
      external: [],
    };
    const g = buildFlowGraph(d, flow);
    const col = Object.fromEntries(g.nodes.map(n => [n.label, n.column]));
    expect(col).toEqual({ 'Log in': 0, 'List products': 1, 'Get product': 2 });
    expect(g.nodes.find(n => n.id === LOGIN_NODE_ID)?.detail).toBe(
      'shop.example'
    );
    expect(g.nodes.find(n => n.label === 'Get product')?.ref).toBe(
      'GET https://api.shop.example/v1/products/{id}'
    );
    expect(g.edges.map(e => `${e.source}->${e.target}`)).toContain(
      `login->api.shop.example|GET /v1/products`
    );
  });

  it('an endpoint on another API host is an external tile; an observed auth link replaces the synthetic login', () => {
    const d = doc([ep('GET /v1/orders', 'list orders')]);
    const flow: ApiFlow = {
      apiHost: d.apiHost,
      links: [
        {
          from: {
            apiHost: 'auth.shop.example',
            endpointId: 'POST /v1/sign_in',
          },
          to: { apiHost: d.apiHost, endpointId: 'GET /v1/orders' },
          kind: 'auth',
          evidence: 'observed',
          toParam: 'Authorization',
        },
        {
          from: {
            apiHost: 'catalog.shop.example',
            endpointId: 'GET /v2/products',
          },
          to: { apiHost: d.apiHost, endpointId: 'GET /v1/orders' },
          kind: 'data',
          evidence: 'observed',
          toParam: 'sku',
        },
      ],
      external: [
        {
          apiHost: 'catalog.shop.example',
          endpointId: 'GET /v2/products',
          method: 'GET',
          path: '/v2/products',
          summary: 'browse products',
        },
      ],
    };
    const g = buildFlowGraph(d, flow);
    const products = g.nodes.find(n => n.apiHost === 'catalog.shop.example')!;
    expect(products).toMatchObject({
      kind: 'external',
      label: 'Browse products',
      ref: null,
      column: 0,
    });
    expect(g.nodes.find(n => n.apiHost === 'auth.shop.example')).toMatchObject({
      kind: 'external',
      label: 'POST /v1/sign_in',
    });
    expect(g.nodes.some(n => n.id === LOGIN_NODE_ID)).toBe(false);
  });

  it("uses the API's own login endpoint as the first step when it has one", () => {
    const d = doc([
      ep('POST /v1/auth/login', 'create auth login', 'none', 'login'),
      ep('GET /v1/me', 'get me'),
      ep('GET /v1/me/orders', 'list orders'),
    ]);
    const flow: ApiFlow = {
      apiHost: d.apiHost,
      links: [
        {
          from: { apiHost: d.apiHost, endpointId: 'GET /v1/me' },
          to: { apiHost: d.apiHost, endpointId: 'GET /v1/me/orders' },
          kind: 'data',
          evidence: 'inferred',
        },
      ],
      external: [],
    };
    const g = buildFlowGraph(d, flow);
    expect(g.nodes.find(n => n.kind === 'login')).toMatchObject({
      id: 'api.shop.example|POST /v1/auth/login',
      column: 0,
    });
  });

  it('no links, no map; too many nodes are capped', () => {
    expect(
      buildFlowGraph(doc([ep('GET /a', 'a')]), {
        apiHost: 'api.shop.example',
        links: [],
        external: [],
      }).nodes
    ).toEqual([]);
    const many = Array.from({ length: MAX_FLOW_NODES + 10 }, (_, i) =>
      ep(`GET /r${i}/{id}`, `r${i}`, 'none')
    );
    const hub = ep('GET /hub', 'hub', 'none');
    const flow: ApiFlow = {
      apiHost: 'api.shop.example',
      links: many.map(m => ({
        from: { apiHost: 'api.shop.example', endpointId: 'GET /hub' },
        to: { apiHost: 'api.shop.example', endpointId: m.id },
        kind: 'data' as const,
        evidence: 'inferred' as const,
      })),
      external: [],
    };
    const g = buildFlowGraph(doc([hub, ...many]), flow);
    expect(g.nodes).toHaveLength(MAX_FLOW_NODES);
    expect(g.hidden).toBe(11);
    expect(g.nodes.some(n => n.label === 'Hub')).toBe(true);
  });
});

describe('assignColumns', () => {
  it('ignores the edge that closes a cycle', () => {
    const c = assignColumns(
      ['a', 'b', 'c'],
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'c', target: 'a' },
      ]
    );
    expect([c.get('a'), c.get('b'), c.get('c')]).toEqual([0, 1, 2]);
  });
});
