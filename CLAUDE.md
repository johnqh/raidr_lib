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
formatting. No UI components, no styling.

| Item | Value |
| --- | --- |
| npm name | `@sudobility/raidr_lib`, `publishConfig.access: public`, BUSL-1.1 |
| Version | `0.1.1` |
| Entry point | `.` only (`dist/index.js`); `src/index.ts` is the whole public API |
| Peer deps | `@sudobility/raidr_client` ^0.1.0, `@sudobility/raidr_types` ^0.1.2, `@sudobility/di`, `@sudobility/types`, `@tanstack/react-query` >=5, `react` >=18, `zustand` >=5 |
| Consumer | `raidr_app` (dep ^0.1.1) |

## Rules

- `src/hooks/`: wrap `raidr_client` hooks; add derived data, never fetch directly.
- `src/stores/catalogFilterStore.ts`: zustand + sessionStorage for search/page.
- `src/utils/`: pure functions with tests (`connectConfigs`, `skillInstall`, `tools`, `errors`).
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
| `bun run test:unit` (= `test:run`) | Vitest 4 once, happy-dom, `src/test/setup.ts` | 4 files, 13 tests pass |
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
│   ├── useMcp.ts               MCP + companion skill + read/write tools + connect snippets
│   ├── useSkill.ts             skill + install commands + hasMcp
│   └── useSite.ts              site + apiHosts
├── stores/catalogFilterStore.ts zustand persist, sessionStorage key 'raidr-catalog-filters'
├── utils/
│   ├── errors.ts               isNotFoundError, detailState
│   ├── connectConfigs.ts       buildConnectConfigs, mcpServerName, TOKEN_PLACEHOLDER
│   ├── skillInstall.ts         skillInstallInstructions, skillMarkdownUrl
│   ├── tools.ts                toolInputFields, formatToolSignature, formatToolRequest, isMutatingTool
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

**Retry.** `useMcp`, `useSkill` (for its MCP lookup) and `useSite` pass
`retry: false`; raidr_client's `useRaidrSkill` already defaults to it. A 404 is
therefore reported immediately. Caching, keys and stale times come from
raidr_client (`STALE_TIMES`: catalog 5 min, detail 10 min).

**Derived data.**
- `useMcp`: `readTools` / `writeTools` split by `isMutatingTool` (non-GET, or a
  description starting `mutates:` case-insensitively); `connect` from
  `buildConnectConfigs` with the optional user `token`; `skill` is the companion
  skill or null (it never drives `notFound`).
- `useSkill`: `install` from `skillInstallInstructions`; `hasMcp` is
  `mcpQuery.data?.success === true`.
- `buildConnectConfigs`: URL `mcpProxyUrl(apiBaseUrl, apiHost)`, header
  `X-Raidr-Token` (`RAIDR_TOKEN_HEADER`), server name `raidr-<host with non
  [a-z0-9] runs as ->`; snippets for Claude Code (CLI + `.mcp.json`), Claude
  Desktop (via `npx -y mcp-remote`) and Cursor. The token is only formatted
  into strings.

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
  raidr_crawler:0 → raidr_cli:0 → raidr_extension:0 → raidr_api:0 → raidr_app:0 →
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
