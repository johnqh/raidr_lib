/**
 * The API page's flow map as plain data: nodes, edges and a laid-out
 * position for each tile. The app only draws it.
 *
 * Nodes are this host's endpoints that take part in a link, endpoints on
 * other hosts that feed or consume them (`external`, drawn in another color
 * and linking to that API's page), the "Log in" step, and `group` tiles: when
 * one endpoint feeds the same value to three or more endpoints that feed
 * nothing further, those endpoints share one tile and one line. The layout is
 * dagre's layered left-to-right layout, so a flow reads
 * Log in → Browse products → Product details and each column is ordered to
 * keep lines from crossing.
 */
import dagre from '@dagrejs/dagre';
import {
  type ApiDoc,
  type ApiFlow,
  type EndpointLink,
  type EndpointLinkEvidence,
  type EndpointLinkKind,
  endpointRef,
  type HttpMethod,
} from '@sudobility/raidr_types';

export const MAX_FLOW_NODES = 60;
export const LOGIN_NODE_ID = 'login';
/** Fewest leaf targets of one source and param that become a group tile. */
export const MIN_GROUP_SIZE = 3;
/** Member rows a collapsed group tile shows. */
export const GROUP_PREVIEW_ROWS = 6;

/** Tile geometry the layout reserves; the app draws tiles at these sizes. */
export const FLOW_TILE = {
  width: 240,
  height: 72,
  groupWidth: 280,
  groupHeader: 40,
  groupRow: 26,
  groupPadding: 12,
} as const;

/** One endpoint inside a group tile. */
export interface FlowGroupMember {
  label: string;
  /** `METHOD /path`. */
  detail: string;
  method: string;
  /** Playground reference. */
  ref: string | null;
}

export interface FlowNode {
  id: string;
  /**
   * - `endpoint`: on this API host; links to its playground (`ref`).
   * - `external`: on another API host; links to that API page (`apiHost`).
   * - `login`: the sign-in step (an endpoint, or the site's sign-in page).
   * - `group`: several endpoints fed the same value by one source.
   */
  kind: 'endpoint' | 'external' | 'login' | 'group';
  label: string;
  /** `METHOD /path` when known. */
  detail: string | null;
  apiHost: string | null;
  /** Playground reference for `endpoint` nodes (and a login endpoint). */
  ref: string | null;
  /** Grouped endpoints, for `group` tiles. */
  members?: FlowGroupMember[];
  /** A group tile shows every member rather than a preview. */
  expanded?: boolean;
  /** Top-left corner and size in layout pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  kind: EndpointLinkKind;
  evidence: EndpointLinkEvidence;
  /** The parameter the value fills (`clip_id`, `Authorization`). */
  label: string | null;
  /** Endpoints behind this edge when it leads into a group tile. */
  count: number;
  /** Closes a cycle; drawn faint and ignored by the layout. */
  back: boolean;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Nodes left out to stay within `MAX_FLOW_NODES`. */
  hidden: number;
  /** Size of the laid-out drawing in pixels. */
  width: number;
  height: number;
}

export interface FlowGraphOptions {
  loginLabel?: string | undefined;
  /** Group tile title; `{{param}}` is replaced (default "Uses {{param}}"). */
  groupLabel?: string | undefined;
  /** Group ids whose tile lists every member. */
  expandedGroups?: ReadonlySet<string> | readonly string[] | undefined;
}

export const EMPTY_FLOW: FlowGraph = {
  nodes: [],
  edges: [],
  hidden: 0,
  width: 0,
  height: 0,
};

type Draft = Omit<FlowNode, 'x' | 'y' | 'width' | 'height'>;
type DraftEdge = Omit<FlowEdge, 'count' | 'back'> & { count?: number };

const nodeId = (apiHost: string, endpointId: string) =>
  `${apiHost}|${endpointId}`;

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Edges that close a cycle, found by DFS in a stable order. */
export function findBackEdges(
  ids: string[],
  edges: Array<{ id: string; source: string; target: string }>
): Set<string> {
  const out = new Map<string, Array<{ id: string; target: string }>>();
  for (const id of ids) out.set(id, []);
  for (const e of edges) out.get(e.source)?.push(e);
  const back = new Set<string>();
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of out.get(id) ?? []) {
      const s = state.get(e.target);
      if (s === 1) back.add(e.id);
      else if (s === undefined && out.has(e.target)) visit(e.target);
    }
    state.set(id, 2);
  };
  for (const id of [...ids].sort()) if (!state.has(id)) visit(id);
  return back;
}

/**
 * Collapse fan-out: edges from one source with the same kind and param into
 * `MIN_GROUP_SIZE` or more leaf endpoints (no outgoing edges, on this host)
 * become one edge into one group tile.
 */
function groupFanOut(
  nodes: Map<string, Draft>,
  edges: DraftEdge[],
  options: FlowGraphOptions
): DraftEdge[] {
  const outgoing = new Set(edges.map(e => e.source));
  const incoming = new Map<string, number>();
  for (const e of edges)
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  const buckets = new Map<string, DraftEdge[]>();
  for (const e of edges) {
    const target = nodes.get(e.target);
    // A leaf fed only by this source: grouping it loses no other line.
    if (
      !target ||
      target.kind !== 'endpoint' ||
      outgoing.has(e.target) ||
      incoming.get(e.target) !== 1
    ) {
      continue;
    }
    const key = `${e.source}|${e.kind}|${e.label ?? ''}`;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  const expanded = new Set(options.expandedGroups ?? []);
  const template = options.groupLabel ?? 'Uses {{param}}';
  const grouped = new Set<string>();
  const added: DraftEdge[] = [];
  for (const [key, list] of [...buckets].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const first = list[0];
    if (!first || list.length < MIN_GROUP_SIZE) continue;
    const id = `group:${key}`;
    const members = list
      .flatMap(e => {
        const n = nodes.get(e.target);
        return n ? [n] : [];
      })
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(n => ({
        label: n.label,
        detail: n.detail ?? n.label,
        method: (n.detail ?? '').split(' ')[0] ?? '',
        ref: n.ref,
      }));
    nodes.set(id, {
      id,
      kind: 'group',
      label: template.replace('{{param}}', first.label ?? '…'),
      detail: null,
      apiHost: nodes.get(first.source)?.apiHost ?? null,
      ref: null,
      members,
      expanded: expanded.has(id),
    });
    for (const e of list) {
      grouped.add(e.id);
      nodes.delete(e.target);
    }
    added.push({
      id: `${first.source}->${id}|${first.kind}`,
      source: first.source,
      target: id,
      kind: first.kind,
      evidence: list.some(e => e.evidence === 'observed')
        ? 'observed'
        : 'inferred',
      label: first.label,
      count: list.length,
    });
  }
  return [...edges.filter(e => !grouped.has(e.id)), ...added];
}

function tileSize(node: Draft): { width: number; height: number } {
  if (node.kind !== 'group') {
    return { width: FLOW_TILE.width, height: FLOW_TILE.height };
  }
  const count = node.members?.length ?? 0;
  const rows = node.expanded ? count : Math.min(count, GROUP_PREVIEW_ROWS);
  const more = count > rows || node.expanded ? 1 : 0;
  return {
    width: FLOW_TILE.groupWidth,
    height:
      FLOW_TILE.groupHeader +
      (rows + more) * FLOW_TILE.groupRow +
      FLOW_TILE.groupPadding,
  };
}

/** dagre's layered layout, left to right; back edges do not shape it. */
function layout(
  drafts: Draft[],
  edges: FlowEdge[]
): { nodes: FlowNode[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: 'LR',
    ranker: 'network-simplex',
    nodesep: 24,
    ranksep: 120,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of drafts) g.setNode(n.id, tileSize(n));
  for (const e of edges) {
    if (!e.back) g.setEdge(e.source, e.target, { weight: e.count }, e.id);
  }
  dagre.layout(g);
  const nodes = drafts.map(n => {
    const p = g.node(n.id);
    return {
      ...n,
      x: Math.round(p.x - p.width / 2),
      y: Math.round(p.y - p.height / 2),
      width: p.width,
      height: p.height,
    };
  });
  const graph = g.graph();
  return {
    nodes,
    width: Math.ceil(graph.width ?? 0),
    height: Math.ceil(graph.height ?? 0),
  };
}

/**
 * Everything upstream and downstream of `nodeId`: the tiles and lines to
 * keep lit when it is focused.
 */
export function flowPath(
  graph: Pick<FlowGraph, 'edges'>,
  nodeId: string
): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set([nodeId]);
  const edges = new Set<string>();
  const walk = (from: 'source' | 'target', to: 'source' | 'target') => {
    const queue = [nodeId];
    const seen = new Set(queue);
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const e of graph.edges) {
        if (e[from] !== id || e.back) continue;
        edges.add(e.id);
        nodes.add(e[to]);
        if (!seen.has(e[to])) {
          seen.add(e[to]);
          queue.push(e[to]);
        }
      }
    }
  };
  walk('source', 'target');
  walk('target', 'source');
  return { nodes, edges };
}

/**
 * Build the flow map for `doc`'s host from its flow links. Returns an empty
 * graph when no link touches the host.
 */
export function buildFlowGraph(
  doc: ApiDoc,
  flow: ApiFlow | null,
  options: FlowGraphOptions = {}
): FlowGraph {
  const host = doc.apiHost;
  const links: EndpointLink[] = flow?.links ?? doc.links ?? [];
  const byId = new Map(doc.endpoints.map(e => [e.id, e]));
  const external = new Map(
    (flow?.external ?? []).map(x => [nodeId(x.apiHost, x.endpointId), x])
  );

  const nodes = new Map<string, Draft>();
  const addEndpoint = (apiHost: string, endpointId: string) => {
    const id = nodeId(apiHost, endpointId);
    if (nodes.has(id)) return id;
    if (apiHost === host) {
      const e = byId.get(endpointId);
      nodes.set(id, {
        id,
        kind: e?.role === 'login' ? 'login' : 'endpoint',
        label: e ? sentence(e.summary) : endpointId,
        detail: e ? `${e.method} ${e.path}` : endpointId,
        apiHost: host,
        ref: e ? endpointRef(doc.baseUrl, e) : null,
      });
    } else {
      const x = external.get(id);
      const space = endpointId.indexOf(' ');
      const method = (x?.method ?? endpointId.slice(0, space)) as HttpMethod;
      const path = x?.path ?? endpointId.slice(space + 1);
      nodes.set(id, {
        id,
        kind: 'external',
        label: x?.summary ? sentence(x.summary) : `${method} ${path}`,
        detail: `${apiHost} · ${method} ${path}`,
        apiHost,
        ref: null,
      });
    }
    return id;
  };

  let edges: DraftEdge[] = [];
  const edgeIds = new Set<string>();
  for (const link of links) {
    if (link.from.apiHost !== host && link.to.apiHost !== host) continue;
    const source = addEndpoint(link.from.apiHost, link.from.endpointId);
    const target = addEndpoint(link.to.apiHost, link.to.endpointId);
    const id = `${source}->${target}|${link.kind}`;
    if (edgeIds.has(id)) continue;
    edgeIds.add(id);
    edges.push({
      id,
      source,
      target,
      kind: link.kind,
      evidence: link.evidence,
      label: link.toParam ?? null,
    });
  }
  if (nodes.size === 0) return EMPTY_FLOW;

  // "Log in" first: user endpoints with nothing feeding them start from it,
  // unless the traffic already showed where their token comes from.
  const hasAuthLink = edges.some(e => e.kind === 'auth');
  if (!hasAuthLink) {
    const fed = new Set(edges.map(e => e.target));
    const roots = Array.from(nodes.values()).filter(
      n =>
        n.kind === 'endpoint' &&
        !fed.has(n.id) &&
        byId.get(n.id.slice(host.length + 1))?.auth === 'user'
    );
    if (roots.length > 0) {
      const loginEndpoint = doc.endpoints.find(e => e.role === 'login');
      const loginId = loginEndpoint
        ? addEndpoint(host, loginEndpoint.id)
        : LOGIN_NODE_ID;
      if (!loginEndpoint) {
        nodes.set(LOGIN_NODE_ID, {
          id: LOGIN_NODE_ID,
          kind: 'login',
          label: options.loginLabel ?? 'Log in',
          detail: doc.auth.user?.loginUrl
            ? new URL(doc.auth.user.loginUrl).hostname
            : null,
          apiHost: null,
          ref: null,
        });
      }
      for (const root of roots) {
        if (root.id === loginId) continue;
        edges.push({
          id: `${loginId}->${root.id}|auth`,
          source: loginId,
          target: root.id,
          kind: 'auth',
          evidence: 'inferred',
          label: null,
        });
      }
    }
  }

  edges = groupFanOut(nodes, edges, options);

  // Keep the most connected nodes when there are too many.
  let kept = Array.from(nodes.values());
  let hidden = 0;
  if (kept.length > MAX_FLOW_NODES) {
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    kept = kept
      .sort(
        (a, b) =>
          (b.kind === 'login' ? 1 : 0) - (a.kind === 'login' ? 1 : 0) ||
          (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
          a.id.localeCompare(b.id)
      )
      .slice(0, MAX_FLOW_NODES);
    hidden = nodes.size - kept.length;
  }
  kept.sort((a, b) => a.id.localeCompare(b.id));
  const keptIds = new Set(kept.map(n => n.id));
  const keptDrafts = edges
    .filter(e => keptIds.has(e.source) && keptIds.has(e.target))
    .sort((a, b) => a.id.localeCompare(b.id));
  const back = findBackEdges(Array.from(keptIds), keptDrafts);
  const keptEdges: FlowEdge[] = keptDrafts.map(e => ({
    ...e,
    count: e.count ?? 1,
    back: back.has(e.id),
  }));
  const laid = layout(kept, keptEdges);
  return { ...laid, edges: keptEdges, hidden };
}
