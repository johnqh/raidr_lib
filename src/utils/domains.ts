/** Crawled sites as entries for the domain browser. Pure. */
import type { Site } from '@sudobility/raidr_types';

export interface DomainEntry {
  /** The crawled origin, e.g. `https://www.suno.com`. */
  origin: string;
  /** What to show: the hostname without `www.`. */
  domain: string;
  /** API hosts behind the site, sorted; each may have docs, an MCP server and a skill. */
  apiHosts: string[];
  lastCrawledAt: string | null;
}

export function toDomainEntry(site: Site): DomainEntry {
  let domain = site.origin;
  try {
    domain = new URL(site.origin).hostname.replace(/^www\./, '');
  } catch {
    // keep the origin as given
  }
  return {
    origin: site.origin,
    domain,
    apiHosts: [...site.api_hosts].sort(),
    lastCrawledAt: site.last_crawled_at
      ? new Date(site.last_crawled_at).toISOString()
      : null,
  };
}
