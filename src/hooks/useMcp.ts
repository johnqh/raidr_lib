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

export interface UseMcpOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  apiHost: string;
  /** User-entered site token for the connection snippets; never sent anywhere. */
  token?: string;
}

export interface UseMcpResult {
  mcp: Mcp | null;
  manifest: McpManifest | null;
  tools: McpTool[];
  readTools: McpTool[];
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

/** One MCP with its tools split by effect, its skill, and ready-to-copy connection configs. */
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
