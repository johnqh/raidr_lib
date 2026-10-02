# CLAUDE.md — raidr_lib

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.

Platform-neutral business logic between `raidr_client` and the UIs. Published as
`@sudobility/raidr_lib` 0.1.x (public). Bun only. Mirrors `sudojo_lib`.

Note: versions below 0.1.0 of this npm name were an unrelated package, now
`@sudobility/raidr_processor`. Never publish a 0.0.x here. (npm still lists
0.0.6 and 0.0.7 next to 0.1.0 and 0.1.1.)

## Purpose and layer position

```
raidr_types → raidr_client → raidr_lib (this repo) → raidr_app
```

Hooks that turn raidr_client queries into what a page renders (paged catalogs,
detail records classified as loading / found / missing / failed), plus pure
helpers: MCP-client connection snippets, skill install commands, tool
formatting, and the API playground's form model, remembered credentials and
flow-map layout. No UI components, no styling.

| Item | Value |
| --- | --- |
| npm name | `@sudobility/raidr_lib`, `publishConfig.access: public`, BUSL-1.1 |
| Version | `0.1.6` |
| Entry point | `.` only (`dist/index.js`); `src/index.ts` is the whole public API |
| Peer deps | `@sudobility/raidr_client` ^0.1.4, `@sudobility/raidr_types` ^0.1.6, `@sudobility/di`, `@sudobility/types`, `@tanstack/react-query` >=5, `react` >=18, `zustand` >=5 |
| Consumer | `raidr_app` (dep ^0.1.6) |

## Rules

- `src/hooks/`: wrap `raidr_client` hooks; add derived data, never fetch directly.
- `src/stores/catalogFilterStore.ts`: zustand + sessionStorage for search/page.
- `src/utils/`: pure functions with tests (`connectConfigs`, `skillInstall`, `tools`, `errors`, `params`, `credentials`, `flow`).
- Every hook takes `{ networkClient, baseUrl, ... }` so the app injects its client.
- Anything a page needs to compute goes here, not in raidr_app components.

## Commands

Every command below was run on 2026-09-30 after the documentation pass.

| Command | What it does | Result |
| --- | --- | --- |
| `bun run check-all && bun run build` | the pre-existing check | exit 0 |
| `bun run verify` | lint → typecheck → test:unit → build | exit 0 |
| `bun run check-all` | lint → typecheck → test:unit | exit 0 |
| `bun run quick-check` | lint → typecheck | exit 0 |
| `bun run lint` | ESLint 9 on `src`; `prettier/prettier` is an error | exit 0 |
| `bun run typecheck` | `tsc --noEmit` (tsconfig excludes `*.test.ts`) | exit 0 |
| `bun run test:unit` (= `test:run`) | Vitest 4 once, happy-dom, `src/test/setup.ts` | 8 files, 35 tests pass (re-run 2026-10-02) |
| `bun run test:coverage` | v8 → `coverage/` (gitignored) | exit 0, ~40% lines, no threshold |
| `bun run build` | `tsc -p tsconfig.build.json` → `dist/` (gitignored) | exit 0 |
| `bun run format:check` | Prettier on `src/**/*.ts` | exit 0 |
| `bun run format`, `lint:fix` | rewrite files | not run (they modify files) |
| `bun run dev` (= `build:watch`), `test:watch` | watch modes | not run |

## File map

```
src/
├── index.ts                    public API; nothing else is exported
├── hooks/
│   ├── catalog.ts              CATALOG_PAGE_SIZE (20), CatalogResult; internal useCatalogFilter, toCatalogResult
│   ├── useMcpCatalog.ts        useRaidrMcps + filter 'mcps'
│   ├── useSkillCatalog.ts      useRaidrSkills + filter 'skills'
│   ├── useSiteCatalog.ts       useRaidrSites + filter 'sites'; optional apiHost scope
│   ├── useMcp.ts               public summary; full MCP + tools + connect snippets when signed in
│   ├── useSkill.ts             skill + install commands + hasMcp
│   ├── useSite.ts              site + apiHosts
│   ├── useDomains.ts           useSiteCatalog → DomainEntry[] (domain browser)
│   ├── useApiInspector.ts      API summary; doc + grouped endpoints + flow graph when signed in; hasMcp, skillSlug
│   ├── useEndpointPlayground.ts one endpoint from an endpointRef: form values/errors, credentials, execute
│   └── useSkillBySlug.ts       slug → api_host (useRaidrSkillByName) → useSkill
├── stores/catalogFilterStore.ts zustand persist, sessionStorage key 'raidr-catalog-filters'
├── utils/
│   ├── errors.ts               isNotFoundError, detailState
│   ├── connectConfigs.ts       buildConnectConfigs, mcpServerName, shellQuote, API_KEY_/SITE_TOKEN_PLACEHOLDER
│   ├── skillInstall.ts         skillInstallInstructions (one curl command), skillMarkdownUrl, skillDirectoryName
│   ├── tools.ts                toolInputFields, formatToolSignature, formatToolRequest, isMutatingTool
│   ├── params.ts               paramControl, validateParam, coerceParam, paramPlaceholder, buildExecute
│   ├── credentials.ts          createCredentialStore, browserStorage, openLoginWindow
│   ├── endpoints.ts            groupEndpoints (by tag, 'other' last; each with its endpointRef)
│   ├── domains.ts              toDomainEntry (hostname without www., sorted apiHosts)
│   ├── flow.ts                 buildFlowGraph, assignColumns, MAX_FLOW_NODES (60), LOGIN_NODE_ID
│   └── *.test.ts               tests sit beside the code
└── test/setup.ts               Vitest setup: stubs localStorage, window listeners, matchMedia
```

## Conventions

**Hook shape.** One options object in, one flat result out:
`useX({ networkClient, baseUrl, ...ids }): UseXResult`, with `UseXOptions` /
`UseXResult` exported next to the hook and from `src/index.ts`.

**Catalog hooks** (`useMcpCatalog`, `useSkillCatalog`, `useSiteCatalog`) return
`CatalogResult<T>`: `items, totalCount, page (0-based), pageCount (>= 1),
hasNextPage (from the API), hasPreviousPage (page > 0), search, setSearch,
setPage, isLoading, error, refetch`. They send `q` only when search is
non-empty, `limit: CATALOG_PAGE_SIZE` and `offset: page * CATALOG_PAGE_SIZE`.
`setSearch` resets the page to 0. Filters persist per catalog for the browser
session, so Back from a detail page restores the list.

**Detail hooks** (`useMcp`, `useSkill`, `useSite`) return
`{ ...data, isLoading, notFound, error }` from `detailState` (`utils/errors.ts`):

| Query state | `notFound` | `error` |
| --- | --- | --- |
| disabled (empty id) | true | null |
| loading | false | null |
| error with `status === 404` (`isNotFoundError`) | true | null |
| any other error (`status` 0 = unreachable, 5xx, …) | false | the Error |
| settled, `data.success !== true` | true | null |
| settled, `data.success === true` | false | null |

`isNotFoundError` duck-types `.status === 404`, which is what `NetworkError`
from `@sudobility/types` carries (raidr_client's error path). Pages render
`Loading` → `ErrorState` → `EmptyState` in that order (see raidr_app).

**Auth.** raidr_lib never handles credentials itself. The caller's
`networkClient` carries the user's Firebase token (building_blocks'
`useApi()`), and `useMcp` takes `isAuthenticated` so it only requests the
gated full manifest when someone is signed in. Signed out it returns the public
`summary`, `mcp: null` and `requiresSignIn: true`. `notFound` comes from the
summary query in both states.

The API playground is the exception: `useEndpointPlayground` keeps the
*upstream* site's credentials (a user token and an application key), not
raidr's. `credentials.ts` stores them in `localStorage` per API host under
`raidr:credential:{kind}:{apiHost}` (`kind` = `user` | `api_key`) while
`remember` is on (the default); turning it off clears them. With no usable
storage the store remembers nothing and never throws. `openLoginWindow` opens
`doc.auth.user.loginUrl` (else the first `siteOrigins`) in a
`popup,width=520,height=760` window named `raidr-login`; it returns null when
blocked. The credentials leave the browser only inside an execute request.
`useApiInspector` and `useEndpointPlayground` take `isAuthenticated` and only
request the gated doc and flow when signed in.

**Retry.** `useMcp`, `useSkill` (for its MCP lookup) and `useSite` pass
`retry: false`; raidr_client's `useRaidrSkill` already defaults to it. A 404 is
therefore reported immediately. Caching, keys and stale times come from
raidr_client (`STALE_TIMES`: catalog 5 min, detail 10 min).

**Derived data.**
- `useMcp`: `readTools` / `writeTools` split by `isMutatingTool` (non-GET, or a
  description starting `mutates:` case-insensitively); `connect` from
  `buildConnectConfigs` with the optional user `apiKey` and `siteToken`;
  `skill` is the companion skill or null (it never drives `notFound`).
- `useSkill`: `install` from `skillInstallInstructions`; `hasMcp` reads the
  public MCP summary (the full manifest would 401 when signed out).
- `skillInstallInstructions`: `{ markdownUrl, directory, command }`, where
  `command` is a single `curl -fsSL … --create-dirs -o ~/.claude/skills/<dir>/SKILL.md`.
  `skillDirectoryName` refuses `..` and path separators.
- `buildConnectConfigs`: URL `mcpProxyUrl(apiBaseUrl, apiHost)`; headers
  `Authorization: Bearer <raidr key>` and, when `needsSiteToken`,
  `X-Raidr-Token` (`RAIDR_TOKEN_HEADER`); server name `raidr-<host with non
  [a-z0-9] runs as ->`. Snippets for Claude Code (CLI with `shellQuote`d
  headers + `.mcp.json`), Claude Desktop (`npx -y mcp-remote`, values passed
  through env `RAIDR_AUTH` / `RAIDR_SITE_TOKEN` and `Name:${VAR}` args) and
  Cursor. Empty inputs become `API_KEY_PLACEHOLDER` / `SITE_TOKEN_PLACEHOLDER`.
  Values are only formatted into strings.
- `params.ts`: form values are always strings; `''` means "not sent".
  `paramControl` → `text` (input type from `format`), `number`, `select`
  (`allowOther` when `enumExhaustive === false`), `switch`, `list`
  (comma-separated scalars) or `json` (objects, arrays of objects).
  `validateParam` checks required, enum membership, JSON shape, integer/number
  with min/max, uuid/email/uri/date/date-time, length and `pattern` (a bad
  pattern never blocks). `buildExecute` validates the whole form, parses the
  `additionalBody` JSON editor, and attaches only the credential the
  endpoint's `auth` needs.
- `useEndpointPlayground`: errors are computed for every field; show them for
  `touched` fields, or all of them once `showAllErrors` is set by an execute
  attempt. A new endpoint resets the form. `notFound` covers a malformed
  ref, a missing host and an endpoint absent from the doc.
- `buildFlowGraph(doc, flow)`: nodes are this host's linked endpoints,
  `external` endpoints on other hosts, and `login`. When no `auth` link is
  known, user endpoints with nothing feeding them start from the doc's
  `role: 'login'` endpoint, or else from a synthetic `LOGIN_NODE_ID` node.
  Over `MAX_FLOW_NODES` the most connected nodes are kept (login first) and
  `hidden` counts the rest. `assignColumns` drops cycle-closing edges by DFS
  and places each node at its longest path from a source; rows are by label
  within a column.

## How to add a hook, end to end

1. raidr_types / raidr_client first: the endpoint, a `useRaidr*` hook and its
   query key (see raidr_client's CLAUDE.md). Publish order matters (see Release).
2. Here: `src/hooks/useX.ts` with `UseXOptions` and `UseXResult`; call the
   raidr_client hook, pass `retry: false` for detail lookups, and classify with
   `detailState({ ...query, enabled: id.length > 0 })`.
3. Put any pure computation in `src/utils/<area>.ts` with a `*.test.ts` beside it.
4. Export the hook, its types and any util from `src/index.ts` with JSDoc.
5. `bun run verify`, then use it from a raidr_app page via `useApi()`.

## Release

- Family release: `raidr_app/scripts/push_all.sh`, order (`path:wait`)
  `raidr_types:60 → raidr_processor:60 → raidr_client:60 → raidr_lib:60 →
  raidr_cli:180 → raidr_crawler:0 → raidr_extension:0 → raidr_api:0 → raidr_app:0 →
  raidr_web:0`. After each publish the sourced `push_projects.sh` polls npm for
  the new version (the number is a cap). Never run it unasked.
- A push to `main` runs `.github/workflows/ci-cd.yml` → johnqh/workflows
  `unified-cicd.yml`: typecheck, lint, `test:unit`, build, then `npm publish`
  (public) only when this `package.json` version is not on npm yet.
- A raidr_client change used here must be published before this repo's CI can
  install it: bump the raidr_client peer/dev range only to a version npm serves.

## Gotchas

- `tsconfig.build.json` sets `removeComments: false` (the base tsconfig sets
  `true`), so JSDoc reaches `dist/*.d.ts`. Keep it.
- Strict base tsconfig (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`):
  that is why hooks spread optional fields as `...(token ? { token } : {})`.
  The build config relaxes both.
- Only one zustand store instance may exist: the app must not bundle two copies
  of raidr_lib (raidr_app's `vite.config.ts` dedupes it).
- `src/test/setup.ts` replaces `localStorage` with `vi.fn()` stubs and is
  compiled into `dist/test/` (the build excludes only `*.test.ts`/`*.spec.ts`).
- ESLint also enforces `prefer-template` and `object-shorthand`; Prettier is
  single quotes, trailing commas `es5`, width 80, `arrowParens: avoid`.
- `typecheck` skips test files; ESLint parses them through `tsconfig.eslint.json`.
