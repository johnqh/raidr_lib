/**
 * Everything the MCP detail page needs from one hook: the manifest, tools
 * split by effect, the companion skill and connection snippets.
 */
import { useMemo } from 'react';
import {
  useRaidrMcp,
  useRaidrMcpSummary,
  useRaidrSkill,
} from '@sudobility/raidr_client';
import type {
  Mcp,
  McpManifest,
  McpSummary,
  McpTool,
  Skill,
} from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import {
  buildConnectConfigs,
  type ConnectConfigs,
} from '../utils/connectConfigs';
import { isMutatingTool } from '../utils/tools';
import { detailState } from '../utils/errors';

/** Inputs for {@link useMcp}. */
export interface UseMcpOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  apiHost: string;
  /**
   * Whether a user is signed in. The full manifest needs auth, so it is only
   * requested when true; signed out, the hook returns the public summary and
   * `requiresSignIn: true`.
   */
  isAuthenticated: boolean;
  /** User-entered raidr API key for the connection snippets; never sent anywhere. */
  apiKey?: string;
  /** User-entered site token for the connection snippets; never sent anywhere. */
  siteToken?: string;
}

/** What {@link useMcp} returns. */
export interface UseMcpResult {
  /** Public top-level info; available signed in or out. */
  summary: McpSummary | null;
  /** The full row with manifest; null while signed out. */
  mcp: Mcp | null;
  manifest: McpManifest | null;
  tools: McpTool[];
  /** Tools for which `isMutatingTool` is false. */
  readTools: McpTool[];
  /** Tools that change upstream state (non-GET or described `mutates:`). */
  writeTools: McpTool[];
  /** The companion skill, when one has been published. */
  skill: Skill | null;
  connect: ConnectConfigs;
  /** Signed out: show the summary and a sign-in prompt instead of details. */
  requiresSignIn: boolean;
  isLoading: boolean;
  /** True only when the API answered that no MCP exists for this host. */
  notFound: boolean;
  /** A failure other than not-found, such as the API being unreachable. */
  error: Error | null;
}

/**
 * One MCP for its detail page. The public summary is always loaded (for the
 * header and the 404 decision); the full manifest only when signed in.
 */
export function useMcp(options: UseMcpOptions): UseMcpResult {
  const {
    networkClient,
    baseUrl,
    apiHost,
    isAuthenticated,
    apiKey,
    siteToken,
  } = options;
  const summaryQuery = useRaidrMcpSummary(networkClient, baseUrl, apiHost, {
    retry: false,
  });
  const mcpQuery = useRaidrMcp(networkClient, baseUrl, apiHost, {
    retry: false,
    enabled: isAuthenticated,
  });
  const skillQuery = useRaidrSkill(networkClient, baseUrl, apiHost);

  const summary = summaryQuery.data?.data ?? null;
  const mcp = isAuthenticated ? (mcpQuery.data?.data ?? null) : null;
  const manifest = mcp?.manifest ?? null;
  const tools = useMemo(() => manifest?.tools ?? [], [manifest]);
  const readTools = useMemo(
    () => tools.filter(t => !isMutatingTool(t)),
    [tools]
  );
  const writeTools = useMemo(() => tools.filter(isMutatingTool), [tools]);
  const connect = useMemo(
    () =>
      buildConnectConfigs({
        apiHost,
        apiBaseUrl: baseUrl,
        needsSiteToken: manifest ? manifest.auth.style !== 'none' : true,
        ...(apiKey ? { apiKey } : {}),
        ...(siteToken ? { siteToken } : {}),
      }),
    [apiHost, baseUrl, apiKey, siteToken, manifest]
  );

  // Existence comes from the public summary; auth failures on the full query
  // are not "not found".
  const summaryState = detailState({
    ...summaryQuery,
    enabled: apiHost.length > 0,
  });
  const fullState = isAuthenticated
    ? detailState({ ...mcpQuery, enabled: apiHost.length > 0 })
    : { notFound: false, error: null };

  return {
    summary,
    mcp,
    manifest,
    tools,
    readTools,
    writeTools,
    skill: skillQuery.data?.data ?? null,
    connect,
    requiresSignIn: !isAuthenticated,
    isLoading:
      summaryQuery.isLoading || (isAuthenticated && mcpQuery.isLoading),
    notFound: summaryState.notFound,
    error: summaryState.error ?? fullState.error,
  };
}
