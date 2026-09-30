import { useRaidrSite } from '@sudobility/raidr_client';
import type { Site } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';

export interface UseSiteOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  origin: string;
}

export interface UseSiteResult {
  site: Site | null;
  apiHosts: string[];
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
}

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
  return {
    site,
    apiHosts: site?.api_hosts ?? [],
    isLoading: query.isLoading,
    notFound: !query.isLoading && !query.data?.success,
    error: query.error,
  };
}
