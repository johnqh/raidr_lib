/**
 * Shared shape for paginated catalog hooks.
 */
import type { PaginatedResponse } from '@sudobility/raidr_types';
import {
  type CatalogKind,
  useCatalogFilterStore,
} from '../stores/catalogFilterStore';

export const CATALOG_PAGE_SIZE = 20;

export interface CatalogResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  search: string;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCatalogFilter(kind: CatalogKind) {
  const filter = useCatalogFilterStore(state => state.filters[kind]);
  const setSearch = useCatalogFilterStore(state => state.setSearch);
  const setPage = useCatalogFilterStore(state => state.setPage);
  return {
    search: filter.search,
    page: filter.page,
    setSearch: (search: string) => setSearch(kind, search),
    setPage: (page: number) => setPage(kind, page),
  };
}

export function toCatalogResult<T>(
  kind: CatalogKind,
  filter: ReturnType<typeof useCatalogFilter>,
  query: {
    data: PaginatedResponse<T> | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => unknown;
  }
): CatalogResult<T> {
  const totalCount = query.data?.pagination.totalCount ?? 0;
  void kind;
  return {
    items: query.data?.data ?? [],
    totalCount,
    page: filter.page,
    pageCount: Math.max(1, Math.ceil(totalCount / CATALOG_PAGE_SIZE)),
    hasNextPage: query.data?.pagination.hasNextPage ?? false,
    hasPreviousPage: filter.page > 0,
    search: filter.search,
    setSearch: filter.setSearch,
    setPage: filter.setPage,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
