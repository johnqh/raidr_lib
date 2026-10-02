/**
 * The domain browser: crawled websites, searchable, each with the API hosts
 * found behind it. Built on the site catalog (same search and paging state).
 */
import { useMemo } from 'react';
import type { NetworkClient } from '@sudobility/types';
import type { CatalogResult } from './catalog';
import { useSiteCatalog } from './useSiteCatalog';
import type { Site } from '@sudobility/raidr_types';
import { type DomainEntry, toDomainEntry } from '../utils/domains';

export interface UseDomainsOptions {
  networkClient: NetworkClient;
  baseUrl: string;
}

export interface UseDomainsResult extends Omit<CatalogResult<Site>, 'items'> {
  domains: DomainEntry[];
}

export function useDomains(options: UseDomainsOptions): UseDomainsResult {
  const { items, ...catalog } = useSiteCatalog({
    networkClient: options.networkClient,
    baseUrl: options.baseUrl,
  });
  const domains = useMemo(() => items.map(toDomainEntry), [items]);
  return { ...catalog, domains };
}
