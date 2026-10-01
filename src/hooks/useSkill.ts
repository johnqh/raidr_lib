import { useMemo } from 'react';
import { useRaidrMcpSummary, useRaidrSkill } from '@sudobility/raidr_client';
import type { Skill } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import { detailState } from '../utils/errors';
import {
  skillInstallInstructions,
  type SkillInstallInstructions,
} from '../utils/skillInstall';

/** Inputs for `useSkill`. */
export interface UseSkillOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  apiHost: string;
}

/** Output of `useSkill`. */
export interface UseSkillResult {
  skill: Skill | null;
  /** True when a manifest exists for the same host, so the page can link to it. */
  hasMcp: boolean;
  /** Copy-ready install commands; null until the skill has loaded. */
  install: SkillInstallInstructions | null;
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
}

/**
 * One skill with install commands, plus whether an MCP exists for the same
 * host. The MCP query reads the public summary (the full manifest needs auth), uses `retry: false` and only feeds `hasMcp`; the skill
 * query alone drives `isLoading`/`notFound`/`error`.
 */
export function useSkill(options: UseSkillOptions): UseSkillResult {
  const { networkClient, baseUrl, apiHost } = options;
  const skillQuery = useRaidrSkill(networkClient, baseUrl, apiHost);
  const mcpQuery = useRaidrMcpSummary(networkClient, baseUrl, apiHost, {
    retry: false,
  });
  const skill = skillQuery.data?.data ?? null;
  const install = useMemo(
    () =>
      skill
        ? skillInstallInstructions({
            apiHost,
            skillName: skill.name,
            apiBaseUrl: baseUrl,
          })
        : null,
    [skill, apiHost, baseUrl]
  );
  const state = detailState({ ...skillQuery, enabled: apiHost.length > 0 });
  return {
    skill,
    hasMcp: mcpQuery.data?.success === true,
    install,
    isLoading: skillQuery.isLoading,
    notFound: state.notFound,
    error: state.error,
  };
}
