import { useRaidrSite } from '@sudobility/raidr_client';
import type { Site } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import { detailState } from '../utils/errors';

/** Inputs for `useSite`. */
export interface UseSiteOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  /** Full origin, e.g. `https://www.example.com` (decoded, not URL-encoded). */
  origin: string;
}

/** Output of `useSite`. */
export interface UseSiteResult {
  site: Site | null;
  /** API hosts the site was seen calling; `[]` until loaded. */
  apiHosts: string[];
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
}

/** One crawled site with its API hosts; 404 becomes `notFound`, no retries. */
export function useSite(options: UseSiteOptions): UseSiteResult {
  const query = useRaidrSite(
    options.networkClient,
    options.baseUrl,
    options.origin,
    {
      retry: false,
    }
  );
  const site = query.data?.data ?? null;
  const state = detailState({ ...query, enabled: options.origin.length > 0 });
  return {
    site,
    apiHosts: site?.api_hosts ?? [],
    isLoading: query.isLoading,
    notFound: state.notFound,
    error: state.error,
  };
}
