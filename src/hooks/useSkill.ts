import { useMemo } from 'react';
import { useRaidrMcp, useRaidrSkill } from '@sudobility/raidr_client';
import type { Skill } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import { detailState } from '../utils/errors';
import {
  skillInstallInstructions,
  type SkillInstallInstructions,
} from '../utils/skillInstall';

export interface UseSkillOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  apiHost: string;
}

export interface UseSkillResult {
  skill: Skill | null;
  /** True when a manifest exists for the same host, so the page can link to it. */
  hasMcp: boolean;
  install: SkillInstallInstructions | null;
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
}

export function useSkill(options: UseSkillOptions): UseSkillResult {
  const { networkClient, baseUrl, apiHost } = options;
  const skillQuery = useRaidrSkill(networkClient, baseUrl, apiHost);
  const mcpQuery = useRaidrMcp(networkClient, baseUrl, apiHost, {
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
