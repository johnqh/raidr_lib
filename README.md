# raidr_lib

Business logic for raidr front ends: catalog hooks with session-persistent
search and paging, MCP/skill/site detail hooks, connection snippets for MCP
clients, and skill install instructions. No UI.

```bash
npm install @sudobility/raidr_lib
```

```tsx
const { items, search, setSearch, page, setPage } = useMcpCatalog({ networkClient, baseUrl });
const { manifest, tools, connect } = useMcp({ networkClient, baseUrl, apiHost, token });
connect.claudeCode.cli; // claude mcp add --transport http … --header "X-Raidr-Token: …"
```

Layer: `raidr_types` → `raidr_client` → **`raidr_lib`** → `raidr_app`.
