/** Grouping an API doc's endpoints for the inspector list. Pure. */
import {
  type ApiDoc,
  type ApiEndpoint,
  endpointRef,
} from '@sudobility/raidr_types';

export interface EndpointListItem {
  endpoint: ApiEndpoint;
  /** `METHOD https://host/path`; the playground link's `endpoint` parameter. */
  ref: string;
}

export interface EndpointGroup {
  tag: string;
  items: EndpointListItem[];
}

/** Endpoints grouped by tag (untagged last), in doc order within a group. */
export function groupEndpoints(doc: ApiDoc): EndpointGroup[] {
  const groups = new Map<string, EndpointListItem[]>();
  for (const endpoint of doc.endpoints) {
    const tag = endpoint.tag ?? 'other';
    const list = groups.get(tag) ?? [];
    list.push({ endpoint, ref: endpointRef(doc.baseUrl, endpoint) });
    groups.set(tag, list);
  }
  return Array.from(groups, ([tag, items]) => ({ tag, items })).sort((a, b) =>
    a.tag === 'other' ? 1 : b.tag === 'other' ? -1 : a.tag.localeCompare(b.tag)
  );
}
