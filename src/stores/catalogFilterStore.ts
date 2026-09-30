/**
 * Search and page state per catalog, kept across navigation within a session.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CatalogKind = 'mcps' | 'skills' | 'sites';

export interface CatalogFilter {
  search: string;
  page: number;
}

interface CatalogFilterState {
  filters: Record<CatalogKind, CatalogFilter>;
  setSearch: (kind: CatalogKind, search: string) => void;
  setPage: (kind: CatalogKind, page: number) => void;
  reset: (kind: CatalogKind) => void;
}

const EMPTY: CatalogFilter = { search: '', page: 0 };

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
