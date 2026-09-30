/**
 * Search and page state per catalog, kept across navigation within a session.
 *
 * Persisted to sessionStorage under `raidr-catalog-filters`, so going back
 * from a detail page restores the list where the user left it, while a new
 * tab starts clean. Falls back to a no-op storage where sessionStorage does
 * not exist (SSR, React Native).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The three catalogs, each with its own independent filter. */
export type CatalogKind = 'mcps' | 'skills' | 'sites';

/** Filter for one catalog. */
export interface CatalogFilter {
  search: string;
  /** Zero-based. */
  page: number;
}

interface CatalogFilterState {
  filters: Record<CatalogKind, CatalogFilter>;
  setSearch: (kind: CatalogKind, search: string) => void;
  setPage: (kind: CatalogKind, page: number) => void;
  reset: (kind: CatalogKind) => void;
}

const EMPTY: CatalogFilter = { search: '', page: 0 };

/**
 * Zustand store with `setSearch` (resets page to 0), `setPage` and `reset`,
 * all per `CatalogKind`. Prefer the catalog hooks over reading it directly.
 */
export const useCatalogFilterStore = create<CatalogFilterState>()(
  persist(
    set => ({
      filters: { mcps: EMPTY, skills: EMPTY, sites: EMPTY },
      setSearch: (kind, search) =>
        set(state => ({
          filters: { ...state.filters, [kind]: { search, page: 0 } },
        })),
      setPage: (kind, page) =>
        set(state => ({
          filters: {
            ...state.filters,
            [kind]: { ...state.filters[kind], page },
          },
        })),
      reset: kind =>
        set(state => ({ filters: { ...state.filters, [kind]: EMPTY } })),
    }),
    {
      name: 'raidr-catalog-filters',
      storage: createJSONStorage(() =>
        typeof globalThis.sessionStorage === 'undefined'
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : globalThis.sessionStorage
      ),
    }
  )
);
