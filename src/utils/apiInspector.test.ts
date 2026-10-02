import { describe, expect, it } from 'vitest';
import type { ApiDoc, Site } from '@sudobility/raidr_types';
import { groupEndpoints } from './endpoints';
import { toDomainEntry } from './domains';

describe('groupEndpoints', () => {
  it('groups by tag, untagged last, with playground references', () => {
    const doc = {
      baseUrl: 'https://api.example.com',
      endpoints: [
        {
          id: 'GET /x',
          method: 'GET',
          path: '/x',
          summary: 'x',
          auth: 'none',
          params: [],
          responses: [],
        },
        {
          id: 'GET /clips',
          method: 'GET',
          path: '/clips',
          summary: 'c',
          auth: 'none',
          params: [],
          responses: [],
          tag: 'clips',
        },
        {
          id: 'GET /billing',
          method: 'GET',
          path: '/billing',
          summary: 'b',
          auth: 'user',
          params: [],
          responses: [],
          tag: 'billing',
        },
      ],
    } as unknown as ApiDoc;
    const groups = groupEndpoints(doc);
    expect(groups.map(g => g.tag)).toEqual(['billing', 'clips', 'other']);
    expect(groups[1]!.items[0]!.ref).toBe('GET https://api.example.com/clips');
  });
});

describe('toDomainEntry', () => {
  it('shows the bare domain and sorted API hosts', () => {
    const site = {
      origin: 'https://www.suno.com',
      api_hosts: ['suno.com', 'studio-api-prod.suno.com'],
      last_crawled_at: null,
    } as unknown as Site;
    expect(toDomainEntry(site)).toEqual({
      origin: 'https://www.suno.com',
      domain: 'suno.com',
      apiHosts: ['studio-api-prod.suno.com', 'suno.com'],
      lastCrawledAt: null,
    });
  });
});
