/**
 * A skill addressed by its slug (`/skills?skill=studio-api-suno-com`): the
 * slug resolves to its API host, then everything `useSkill` provides.
 */
import { useRaidrSkillByName } from '@sudobility/raidr_client';
import type { NetworkClient } from '@sudobility/types';
import { useSkill, type UseSkillResult } from './useSkill';

export interface UseSkillBySlugOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  slug: string;
}

export interface UseSkillBySlugResult extends UseSkillResult {
  /** The API host the slug belongs to; empty until resolved or when unknown. */
  apiHost: string;
}

export function useSkillBySlug(
  options: UseSkillBySlugOptions
): UseSkillBySlugResult {
  const { networkClient, baseUrl, slug } = options;
  const lookup = useRaidrSkillByName(networkClient, baseUrl, slug);
  const apiHost = lookup.data?.success
    ? (lookup.data.data?.api_host ?? '')
    : '';
  const skill = useSkill({ networkClient, baseUrl, apiHost });
  const resolving = slug.length > 0 && lookup.isLoading;
  return {
    ...skill,
    apiHost,
    isLoading: resolving || (apiHost !== '' && skill.isLoading),
    notFound: !resolving && apiHost === '' ? true : skill.notFound,
    error:
      (lookup.error && (lookup.error as { status?: number }).status !== 404
        ? (lookup.error as Error)
        : null) ?? skill.error,
  };
}
