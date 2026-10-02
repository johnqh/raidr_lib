# raidr_lib

Business logic for raidr front ends: catalog hooks with session-persistent
search and paging, MCP/skill/site detail hooks, connection snippets for MCP
clients, skill install instructions, and the API playground: a domain
browser, an API inspector with an endpoint flow map, and an endpoint
playground with typed parameter validation and per-host credentials kept in
the browser. No UI.

```bash
bun add @sudobility/raidr_lib
```

```tsx
const { items, search, setSearch, page, setPage } = useMcpCatalog({ networkClient, baseUrl });
const { manifest, tools, connect } = useMcp({ networkClient, baseUrl, apiHost, isAuthenticated, apiKey, siteToken });
connect.claudeCode.cli; // claude mcp add --transport http … --header "X-Raidr-Token: …"
const play = useEndpointPlayground({ networkClient, baseUrl, endpointRef, isAuthenticated });
play.setValue('clip_id', '…'); play.execute(); // play.result: status, headers, body
```

Layer: `raidr_types` → `raidr_client` → **`raidr_lib`** → `raidr_app`.
