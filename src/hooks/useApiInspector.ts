/**
 * The API inspector for one API host: its endpoint list (grouped by tag, each
 * with a playground link reference) and links to its MCP server and skill
 * when those exist. The endpoint list needs a signed-in user, like the full
 * MCP manifest; the public summary is always loaded.
 */
import { useMemo } from 'react';
import {
  useRaidrApiDoc,
  useRaidrApiFlow,
  useRaidrApiSummary,
  useRaidrMcpSummary,
  useRaidrSkill,
} from '@sudobility/raidr_client';
import type { ApiDoc, ApiDocSummary } from '@sudobility/raidr_types';
import { type EndpointGroup, groupEndpoints } from '../utils/endpoints';
import {
  buildFlowGraph,
  EMPTY_FLOW,
  type FlowGraph,
  type FlowGraphOptions,
} from '../utils/flow';
import type { NetworkClient } from '@sudobility/types';
import { detailState } from '../utils/errors';

export interface UseApiInspectorOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  apiHost: string;
  isAuthenticated: boolean;
  /** Labels and expanded group tiles for the flow map. */
  flowOptions?: FlowGraphOptions;
}

export interface UseApiInspectorResult {
  summary: ApiDocSummary | null;
  doc: ApiDoc | null;
  groups: EndpointGroup[];
  /** The flow map (empty when no links are known). */
  flow: FlowGraph;
  /** An MCP server exists for this host. */
  hasMcp: boolean;
  /** The skill's slug when a skill exists. */
  skillSlug: string | null;
  requiresSignIn: boolean;
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
}

export function useApiInspector(
  options: UseApiInspectorOptions
): UseApiInspectorResult {
  const { networkClient, baseUrl, apiHost, isAuthenticated, flowOptions } =
    options;
  const summaryQuery = useRaidrApiSummary(networkClient, baseUrl, apiHost, {
    retry: false,
  });
  const docQuery = useRaidrApiDoc(networkClient, baseUrl, apiHost, {
    enabled: isAuthenticated,
    retry: false,
  });
  const mcpQuery = useRaidrMcpSummary(networkClient, baseUrl, apiHost, {
    retry: false,
  });
  const skillQuery = useRaidrSkill(networkClient, baseUrl, apiHost, {
    retry: false,
  });

  const doc = (docQuery.data?.success ? docQuery.data.data?.doc : null) ?? null;
  const groups = useMemo(() => (doc ? groupEndpoints(doc) : []), [doc]);
  const flowQuery = useRaidrApiFlow(networkClient, baseUrl, apiHost, {
    enabled: isAuthenticated && !!doc,
    retry: false,
  });
  const flowData = flowQuery.data?.success
    ? (flowQuery.data.data ?? null)
    : null;
  const loginLabel = flowOptions?.loginLabel;
  const groupLabel = flowOptions?.groupLabel;
  // A stable key, so a new array with the same groups does not re-layout.
  const expandedKey = [...(flowOptions?.expandedGroups ?? [])]
    .sort()
    .join('\n');
  const flow = useMemo(
    () =>
      doc
        ? buildFlowGraph(doc, flowData, {
            loginLabel,
            groupLabel,
            expandedGroups: expandedKey ? expandedKey.split('\n') : [],
          })
        : EMPTY_FLOW,
    [doc, flowData, loginLabel, groupLabel, expandedKey]
  );
  const state = detailState({ ...summaryQuery, enabled: apiHost.length > 0 });
  return {
    summary: summaryQuery.data?.data ?? null,
    doc,
    groups,
    flow,
    hasMcp: mcpQuery.data?.success === true,
    skillSlug: skillQuery.data?.success
      ? (skillQuery.data.data?.name ?? null)
      : null,
    requiresSignIn: !isAuthenticated,
    isLoading:
      summaryQuery.isLoading || (isAuthenticated && docQuery.isLoading),
    notFound: state.notFound,
    error:
      state.error ??
      (isAuthenticated ? (docQuery.error as Error | null) : null),
  };
}
