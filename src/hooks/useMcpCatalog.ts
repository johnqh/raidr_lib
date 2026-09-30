import { useRaidrMcps } from '@sudobility/raidr_client';
import type { McpSummary } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import {
  CATALOG_PAGE_SIZE,
  type CatalogResult,
  toCatalogResult,
  useCatalogFilter,
} from './catalog';

/** Inputs for `useMcpCatalog`. */
export interface UseMcpCatalogOptions {
  networkClient: NetworkClient;
  baseUrl: string;
}

/** Searchable, paginated list of published MCPs with filter state kept per session. */
export function useMcpCatalog(
  options: UseMcpCatalogOptions
): CatalogResult<McpSummary> {
  const filter = useCatalogFilter('mcps');
  const query = useRaidrMcps(options.networkClient, options.baseUrl, {
    ...(filter.search ? { q: filter.search } : {}),
    limit: CATALOG_PAGE_SIZE,
    offset: filter.page * CATALOG_PAGE_SIZE,
  });
  return toCatalogResult('mcps', filter, query);
}
