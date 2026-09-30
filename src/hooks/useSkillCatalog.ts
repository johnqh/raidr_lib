import { useRaidrSkills } from '@sudobility/raidr_client';
import type { SkillSummary } from '@sudobility/raidr_types';
import type { NetworkClient } from '@sudobility/types';
import {
  CATALOG_PAGE_SIZE,
  type CatalogResult,
  toCatalogResult,
  useCatalogFilter,
} from './catalog';

/** Inputs for `useSkillCatalog`. */
export interface UseSkillCatalogOptions {
  networkClient: NetworkClient;
  baseUrl: string;
}

/** Searchable, paginated list of published skills; filter kept per session. */
export function useSkillCatalog(
  options: UseSkillCatalogOptions
): CatalogResult<SkillSummary> {
  const filter = useCatalogFilter('skills');
  const query = useRaidrSkills(options.networkClient, options.baseUrl, {
    ...(filter.search ? { q: filter.search } : {}),
    limit: CATALOG_PAGE_SIZE,
    offset: filter.page * CATALOG_PAGE_SIZE,
  });
  return toCatalogResult('skills', filter, query);
}
