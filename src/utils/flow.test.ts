import { describe, expect, it } from 'vitest';
import type { ApiDoc, ApiFlow } from '@sudobility/raidr_types';
import {
  buildFlowGraph,
  findBackEdges,
  type FlowGraph,
  flowPath,
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
    const x = Object.fromEntries(g.nodes.map(n => [n.label, n.x]));
    expect(x['Log in']).toBeLessThan(x['List products']!);
    expect(x['List products']).toBeLessThan(x['Get product']!);
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
    });
    const orders = g.nodes.find(n => n.label === 'List orders')!;
    expect(products.x).toBeLessThan(orders.x);
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
    const login = g.nodes.find(n => n.kind === 'login')!;
    expect(login.id).toBe('api.shop.example|POST /v1/auth/login');
    expect(Math.min(...g.nodes.map(n => n.x))).toBe(login.x);
  });

  it('no links, no map', () => {
    expect(
      buildFlowGraph(doc([ep('GET /a', 'a')]), {
        apiHost: 'api.shop.example',
        links: [],
        external: [],
      }).nodes
    ).toEqual([]);
  });

  it('fan-out into leaves becomes one group tile and one line', () => {
    const leaves = Array.from({ length: 5 }, (_, i) =>
      ep(`GET /p${i}/{project_id}`, `p${i}`, 'none')
    );
    const chain = ep(
      'GET /projects/{project_id}/tracks',
      'list tracks',
      'none'
    );
    const track = ep('GET /tracks/{track_id}', 'get track', 'none');
    const d = doc([
      ep('GET /projects', 'list projects', 'none'),
      ...leaves,
      chain,
      track,
    ]);
    const link = (from: string, to: string, toParam: string) => ({
      from: { apiHost: d.apiHost, endpointId: from },
      to: { apiHost: d.apiHost, endpointId: to },
      kind: 'data' as const,
      evidence: 'inferred' as const,
      toParam,
    });
    const g = buildFlowGraph(
      d,
      {
        apiHost: d.apiHost,
        links: [
          ...leaves.map(l => link('GET /projects', l.id, 'project_id')),
          link('GET /projects', chain.id, 'project_id'),
          link(chain.id, track.id, 'track_id'),
        ],
        external: [],
      },
      { groupLabel: 'Uses {{param}}' }
    );
    const group = g.nodes.find(n => n.kind === 'group')!;
    expect(group.label).toBe('Uses project_id');
    expect(group.members?.map(m => m.label)).toEqual([
      'P0',
      'P1',
      'P2',
      'P3',
      'P4',
    ]);
    expect(group.members?.[0]?.ref).toBe(
      'GET https://api.shop.example/p0/{project_id}'
    );
    // The chain endpoint feeds something, so it stays its own tile.
    expect(g.nodes.map(n => n.label)).toEqual(
      expect.arrayContaining(['List projects', 'List tracks', 'Get track'])
    );
    expect(g.nodes).toHaveLength(4);
    const into = g.edges.filter(e => e.target === group.id);
    expect(into).toHaveLength(1);
    expect(into[0]).toMatchObject({ label: 'project_id', count: 5 });

    const expanded = buildFlowGraph(
      d,
      {
        apiHost: d.apiHost,
        links: leaves.map(l => link('GET /projects', l.id, 'project_id')),
        external: [],
      },
      { expandedGroups: [group.id] }
    );
    expect(expanded.nodes.find(n => n.id === group.id)?.expanded).toBe(true);
  });

  it('lays tiles out without overlap, edges left to right, deterministically', () => {
    const eps = Array.from({ length: 12 }, (_, i) =>
      ep(`GET /r${i}/{id}`, `r${i}`, 'none')
    );
    const d = doc([
      ep('GET /a', 'a', 'none'),
      ep('GET /b', 'b', 'none'),
      ...eps,
    ]);
    const link = (from: string, to: string) => ({
      from: { apiHost: d.apiHost, endpointId: from },
      to: { apiHost: d.apiHost, endpointId: to },
      kind: 'data' as const,
      evidence: 'inferred' as const,
      toParam: to,
    });
    // Distinct params, so nothing groups.
    const flow: ApiFlow = {
      apiHost: d.apiHost,
      links: [
        ...eps.slice(0, 6).map(e => link('GET /a', e.id)),
        ...eps.slice(6).map(e => link('GET /b', e.id)),
        link(eps[0]!.id, eps[7]!.id),
      ],
      external: [],
    };
    const g: FlowGraph = buildFlowGraph(d, flow);
    for (const a of g.nodes) {
      for (const b of g.nodes) {
        if (a === b) continue;
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
    const byId = new Map(g.nodes.map(n => [n.id, n]));
    for (const e of g.edges) {
      expect(byId.get(e.source)!.x).toBeLessThan(byId.get(e.target)!.x);
    }
    expect(buildFlowGraph(d, flow)).toEqual(g);
    expect(g.width).toBeGreaterThan(0);
  });

  it('caps the number of tiles', () => {
    const many = Array.from({ length: MAX_FLOW_NODES + 10 }, (_, i) =>
      ep(`GET /r${i}/{id}`, `r${i}`, 'none')
    );
    const hub = ep('GET /hub', 'hub', 'none');
    // Each target is fed by two sources, so none is a groupable leaf.
    const hub2 = ep('GET /hub2', 'hub2', 'none');
    const flow: ApiFlow = {
      apiHost: 'api.shop.example',
      links: many.flatMap(m =>
        ['GET /hub', 'GET /hub2'].map(from => ({
          from: { apiHost: 'api.shop.example', endpointId: from },
          to: { apiHost: 'api.shop.example', endpointId: m.id },
          kind: 'data' as const,
          evidence: 'inferred' as const,
        }))
      ),
      external: [],
    };
    const g = buildFlowGraph(doc([hub, hub2, ...many]), flow);
    expect(g.nodes).toHaveLength(MAX_FLOW_NODES);
    expect(g.hidden).toBe(12);
    expect(g.nodes.some(n => n.label === 'Hub')).toBe(true);
  });
});

describe('findBackEdges and flowPath', () => {
  const edges = [
    { id: 'ab', source: 'a', target: 'b', back: false },
    { id: 'bc', source: 'b', target: 'c', back: false },
    { id: 'ca', source: 'c', target: 'a', back: false },
    { id: 'xd', source: 'x', target: 'd', back: false },
  ];
  it('marks the edge that closes a cycle', () => {
    expect([...findBackEdges(['a', 'b', 'c', 'x', 'd'], edges)]).toEqual([
      'ca',
    ]);
  });
  it('lights only what is connected', () => {
    const p = flowPath(
      { edges: edges.filter(e => e.id !== 'ca') } as Pick<FlowGraph, 'edges'>,
      'b'
    );
    expect([...p.nodes].sort()).toEqual(['a', 'b', 'c']);
    expect([...p.edges].sort()).toEqual(['ab', 'bc']);
  });
});
