import { useRaidrSites } from '@sudobility/raidr_client';
import type { Site } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import {
  CATALOG_PAGE_SIZE,
  type CatalogResult,
  toCatalogResult,
  useCatalogFilter,
} from './catalog';

export interface UseSiteCatalogOptions {
  networkClient: NetworkClient;
  baseUrl: string;
  /** Only sites that call this API host (used on the MCP detail page). */
  apiHost?: string;
}

export function useSiteCatalog(
  options: UseSiteCatalogOptions
): CatalogResult<Site> {
  const filter = useCatalogFilter('sites');
  const scoped = options.apiHost !== undefined;
  const query = useRaidrSites(options.networkClient, options.baseUrl, {
    ...(!scoped && filter.search ? { q: filter.search } : {}),
    ...(options.apiHost ? { apiHost: options.apiHost } : {}),
    limit: CATALOG_PAGE_SIZE,
    offset: scoped ? 0 : filter.page * CATALOG_PAGE_SIZE,
  });
  return toCatalogResult('sites', filter, query);
}
