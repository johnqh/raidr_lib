/**
 * The API page's flow map as plain data: nodes, edges and a column/row
 * layout. The app only draws it.
 *
 * Nodes are this host's endpoints that take part in a link, endpoints on
 * other hosts that feed or consume them (`external`, drawn in another color
 * and linking to that API's page), and the "Log in" step. Columns are the
 * longest path from a start node, so a flow reads left to right:
 * Log in → Browse products → Product details.
 */
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

export interface FlowNode {
  id: string;
  /**
   * - `endpoint`: on this API host; links to its playground (`ref`).
   * - `external`: on another API host; links to that API page (`apiHost`).
   * - `login`: the sign-in step (an endpoint, or the site's sign-in page).
   */
  kind: 'endpoint' | 'external' | 'login';
  label: string;
  /** `METHOD /path` when known. */
  detail: string | null;
  apiHost: string | null;
  /** Playground reference for `endpoint` nodes (and a login endpoint). */
  ref: string | null;
  column: number;
  row: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  kind: EndpointLinkKind;
  evidence: EndpointLinkEvidence;
  /** The parameter the value fills (`clip_id`, `Authorization`). */
  label: string | null;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Nodes left out to stay within `MAX_FLOW_NODES`. */
  hidden: number;
  /** Number of columns, for sizing. */
  columns: number;
}

const nodeId = (apiHost: string, endpointId: string) =>
  `${apiHost}|${endpointId}`;

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Columns by longest path from the sources, ignoring edges that close a
 * cycle (found by DFS), so every edge that remains points right.
 */
export function assignColumns(
  ids: string[],
  edges: Array<{ source: string; target: string }>
): Map<string, number> {
  const out = new Map<string, string[]>();
  for (const id of ids) out.set(id, []);
  for (const e of edges) {
    if (out.has(e.target)) out.get(e.source)?.push(e.target);
  }
  // Drop back edges (an edge to a node still on the DFS stack).
  const state = new Map<string, 1 | 2>();
  const forward = new Map<string, string[]>(ids.map(id => [id, []]));
  const visit = (id: string) => {
    state.set(id, 1);
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 1) continue;
      forward.get(id)?.push(next);
      if (!state.has(next)) visit(next);
    }
    state.set(id, 2);
  };
  for (const id of [...ids].sort()) if (!state.has(id)) visit(id);
  // Longest path by topological order (Kahn).
  const indegree = new Map<string, number>(ids.map(id => [id, 0]));
  for (const targets of forward.values()) {
    for (const t of targets) indegree.set(t, (indegree.get(t) ?? 0) + 1);
  }
  const queue = ids.filter(id => indegree.get(id) === 0).sort();
  const column = new Map<string, number>(ids.map(id => [id, 0]));
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const here = column.get(id) ?? 0;
    for (const t of forward.get(id) ?? []) {
      column.set(t, Math.max(column.get(t) ?? 0, here + 1));
      const left = (indegree.get(t) ?? 0) - 1;
      indegree.set(t, left);
      if (left === 0) queue.push(t);
    }
  }
  return column;
}

/**
 * Build the flow map for `doc`'s host from its flow links. Returns an empty
 * graph when no link touches the host.
 */
export function buildFlowGraph(
  doc: ApiDoc,
  flow: ApiFlow | null,
  options: { loginLabel?: string } = {}
): FlowGraph {
  const host = doc.apiHost;
  const links: EndpointLink[] = flow?.links ?? doc.links ?? [];
  const byId = new Map(doc.endpoints.map(e => [e.id, e]));
  const external = new Map(
    (flow?.external ?? []).map(x => [nodeId(x.apiHost, x.endpointId), x])
  );

  const nodes = new Map<string, Omit<FlowNode, 'column' | 'row'>>();
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

  const edges: FlowEdge[] = [];
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
  if (nodes.size === 0) return { nodes: [], edges: [], hidden: 0, columns: 0 };

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
  const keptIds = new Set(kept.map(n => n.id));
  const keptEdges = edges.filter(
    e => keptIds.has(e.source) && keptIds.has(e.target)
  );
  const columns = assignColumns(Array.from(keptIds), keptEdges);
  const rows = new Map<number, number>();
  const placed: FlowNode[] = kept
    .map(n => ({ ...n, column: columns.get(n.id) ?? 0, row: 0 }))
    .sort((a, b) => a.column - b.column || a.label.localeCompare(b.label))
    .map(n => {
      const row = rows.get(n.column) ?? 0;
      rows.set(n.column, row + 1);
      return { ...n, row };
    });
  return {
    nodes: placed,
    edges: keptEdges,
    hidden,
    columns: placed.reduce((m, n) => Math.max(m, n.column + 1), 0),
  };
}
