/**
 * Everything the MCP detail page needs from one hook: the manifest, tools
 * split by effect, the companion skill and connection snippets.
 */
import { useMemo } from 'react';
import { useRaidrMcp, useRaidrSkill } from '@sudobility/raidr_client';
import type { Mcp, McpManifest, McpTool, Skill } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import {
  buildConnectConfigs,
  type ConnectConfigs,
} from '../utils/connectConfigs';
import { isMutatingTool } from '../utils/tools';
import { detailState } from '../utils/errors';

/** Inputs for `useMcp`. */
export interface UseMcpOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  apiHost: string;
  /** User-entered site token for the connection snippets; never sent anywhere. */
  token?: string;
}

/** Output of `useMcp`. */
export interface UseMcpResult {
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
  isLoading: boolean;
  /** True only when the API answered that no MCP exists for this host. */
  notFound: boolean;
  /** A failure other than not-found, such as the API being unreachable. */
  error: Error | null;
}

/**
 * One MCP with its tools split by effect, its skill, and ready-to-copy
 * connection configs. Both queries run in parallel with `retry: false`, so a
 * 404 shows as `notFound` at once instead of after three retries. Only the
 * MCP query drives `isLoading`/`notFound`/`error`; a missing skill just
 * leaves `skill` null.
 */
export function useMcp(options: UseMcpOptions): UseMcpResult {
  const { networkClient, baseUrl, apiHost, token } = options;
  const mcpQuery = useRaidrMcp(networkClient, baseUrl, apiHost, {
    retry: false,
  });
  const skillQuery = useRaidrSkill(networkClient, baseUrl, apiHost);

  const mcp = mcpQuery.data?.data ?? null;
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
        ...(token ? { token } : {}),
      }),
    [apiHost, baseUrl, token]
  );

  const state = detailState({ ...mcpQuery, enabled: apiHost.length > 0 });
  return {
    mcp,
    manifest,
    tools,
    readTools,
    writeTools,
    skill: skillQuery.data?.data ?? null,
    connect,
    isLoading: mcpQuery.isLoading,
    notFound: state.notFound,
    error: state.error,
  };
}
