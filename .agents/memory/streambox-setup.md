---
name: StreamBox setup
description: How the project was set up after GitHub import and what screens exist
---

## Workflow configuration

`listArtifacts()` returned empty after GitHub import — artifacts exist on disk but are not registered with the platform. Worked around by calling `configureWorkflow` manually:

- **API Server**: `PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080, console)
- **StreamBox**: `PORT=8099 pnpm --filter @workspace/streambox run dev` (port 8099, webview)

**Why:** `WorkflowsRestart` with artifact-style names failed because the artifacts weren't registered. `createArtifact` would also fail since the directories already exist.

**How to apply:** If workflows disappear or need to be recreated, use `configureWorkflow` with the commands above.

## Preview registration

The imported mobile artifact can run successfully through its configured Expo workflow even when `listArtifacts()` returns an empty list. In that state, the app is available through the Replit/Expo preview and QR flow, but automated artifact screenshot lookup may report the artifact as missing.

**Why:** GitHub imports may leave artifact metadata on disk without registering it with the platform artifact index.

**How to apply:** Verify the workflow logs and use the Replit preview/Expo QR flow; do not keep recreating the artifact directory or replacing the managed mobile workflow.

## Managed workflow routing

Once imported artifacts are registered, use `artifacts/streambox: expo` and `artifacts/api-server: API Server`; stop the legacy `StreamBox` and `API Server` workflows to avoid port conflicts.

**Why:** Both API workflows target port 8080, and the duplicate legacy process can make the managed API fail with `EADDRINUSE` even while the old preview appears healthy.

**How to apply:** Restart the exact artifact-owned workflow names from `artifact.toml`, then verify `/status` for StreamBox and `/api/healthz` for the API.

## Workspace dependency installation

For package additions, target the owning workspace package with `pnpm --filter <package> add ...`; adding from the monorepo root triggers pnpm's workspace-root guard and can restart unrelated workflows.

**Why:** Dependencies belong to the artifact package, and package installation may restart all configured workflows, exposing duplicate legacy processes on shared ports.

**How to apply:** Install API dependencies in `@workspace/api-server`, then stop duplicate legacy workflows and restart the artifact-owned API workflow.

## customFetch export

Added `customFetch` to `lib/api-client-react/src/index.ts` exports so screens can make custom API calls (e.g. with `?type=tv` query param) without duplicating base URL logic.

## Screens built

All four missing screens were added:
- `artifacts/streambox/app/(tabs)/search.tsx` — debounced search via `/api/catalog/search`
- `artifacts/streambox/app/(tabs)/my-list.tsx` — AsyncStorage watchlist display
- `artifacts/streambox/app/detail/[id].tsx` — full title detail with stills, cast, play/save
- `artifacts/streambox/app/player.tsx` — full-screen cinematic player UI

## Navigation pattern

PosterCard and featured hero navigate with `?type=${mediaType}` query param so the detail screen can request the correct TMDB media type. Player receives `titleName` and `backdropUrl` as encoded query params.

## Search endpoint

Added `GET /api/catalog/search?q=...` to `artifacts/api-server/src/routes/catalog.ts` using TMDB `/search/multi`. 5-minute in-memory cache.
