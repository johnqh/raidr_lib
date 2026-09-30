# CLAUDE.md — raidr_lib

Platform-neutral business logic between `raidr_client` and the UIs. Published as
`@sudobility/raidr_lib` 0.1.x (public). Bun only. Mirrors `sudojo_lib`.

Note: versions below 0.1.0 of this npm name were an unrelated package, now
`@sudobility/raidr_processor`. Never publish a 0.0.x here.

- `src/hooks/`: wrap `raidr_client` hooks; add derived data, never fetch directly.
- `src/stores/catalogFilterStore.ts`: zustand + sessionStorage for search/page.
- `src/utils/`: pure functions with tests (`connectConfigs`, `skillInstall`, `tools`).
- Every hook takes `{ networkClient, baseUrl, ... }` so the app injects its client.

```bash
bun run check-all && bun run build
```
