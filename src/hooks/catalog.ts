/**
 * Shared shape for paginated catalog hooks: filter state from the session
 * store in, a flat `CatalogResult` out. Only `CATALOG_PAGE_SIZE` and
 * `CatalogResult` are public; the two helpers are internal to `src/hooks`.
 */
import type { PaginatedResponse } from '@sudobility/raidr_types';
import {
  type CatalogKind,
  useCatalogFilterStore,
} from '../stores/catalogFilterStore';

/** Items per catalog page; sent as `limit`, and `offset = page * size`. */
export const CATALOG_PAGE_SIZE = 20;

/** What every catalog hook returns; list pages render straight from it. */
export interface CatalogResult<T> {
  items: T[];
  /** From the API's `pagination.totalCount`; 0 while loading. */
  totalCount: number;
  /** Zero-based. */
  page: number;
  /** At least 1, even for an empty catalog. */
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  search: string;
  /** Also resets the page to 0. */
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  isLoading: boolean;
  /** The query's error as thrown (a `NetworkError` from the web client). */
  error: Error | null;
  refetch: () => void;
}

/** Search and page for one catalog, with setters bound to that catalog. */
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

/**
 * Flatten a paginated query plus filter state into a `CatalogResult`.
 * `hasNextPage` comes from the API; `hasPreviousPage` from the local page.
 * `kind` is accepted but unused (`void kind`).
 */
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
