---
name: StreamBox setup
description: How the project was set up after GitHub import and what screens exist
---

## Artifact registration

After GitHub import, artifacts existed on disk but were not registered with the platform (`listArtifacts()` returned empty). Fixed by calling `verifyAndReplaceArtifactToml` on `artifacts/streambox/.replit-artifact/artifact.toml` (updating localPort from 24877 → 8099 to match the running workflow). This triggered platform registration for all three artifacts.

**Registered artifact IDs:**
- StreamBox: `artifacts/streambox` (mobile, previewPath `/`, port 8099)
- API Server: `3B4_FFSkEVBkAeYMFRJ2e` (api, port 8080)
- Canvas: `XegfDyZt7HqfW2Bb8Ghoy` (design, mockup-sandbox)

**Why:** GitHub imports copy artifact.toml files but do not register them with the platform artifact index. `verifyAndReplaceArtifactToml` triggers registration as a side effect.

## Managed workflow names (use these with WorkflowsRestart)

- `artifacts/streambox: expo` — Expo/Metro bundler, port 8099
- `artifacts/api-server: API Server` — Express API, port 8080
- `artifacts/mockup-sandbox: Component Preview Server` — mockup sandbox

**Do NOT use** the legacy `StreamBox` or `API Server` manual workflows — they conflict on the same ports.

## Port conflict resolution

If managed workflows fail with EADDRINUSE, the legacy manual workflows are still holding the ports. Kill the conflicting processes:
```bash
lsof -ti :8080 -ti :8099 | xargs kill -9
```
Then restart the managed workflows.

## customFetch export

`customFetch` exported from `lib/api-client-react/src/index.ts` so screens can make custom API calls (e.g. with `?type=tv` query param) without duplicating base URL logic.

## Screens

- `artifacts/streambox/app/(tabs)/index.tsx` — home with 18 genre rails (30 items each)
- `artifacts/streambox/app/(tabs)/search.tsx` — debounced search
- `artifacts/streambox/app/(tabs)/my-list.tsx` — AsyncStorage watchlist
- `artifacts/streambox/app/detail/[id].tsx` — title detail with cast, episodes, play/save
- `artifacts/streambox/app/player.tsx` — WebView player (vidsrc.to embed, 4 source fallbacks)

## Player navigation params

Player receives: `id`, `type`, `season`, `episode`, `titleName`, `episodeLabel` (all query params, URL-encoded). For TV episodes, season/episode are passed explicitly. Player builds vidsrc.to embed URL client-side.

## Video stream sources (player.tsx)

4 fallback sources built into player, selectable via UI:
1. vidsrc.to — `https://vidsrc.to/embed/movie/{id}` or `/tv/{id}/{s}/{e}`
2. vidsrc.me — `https://vidsrc.me/embed/movie?tmdb={id}`
3. vidsrc.xyz — `https://vidsrc.xyz/embed/movie/{id}`
4. multiembed.mov — `https://multiembed.mov/?video_id={id}&tmdb=1`

## Stream API endpoint

`GET /api/catalog/stream/:id?type=movie|tv&season=1&episode=1` — returns `{ embedUrls, primaryUrl }` for all 4 sources.

## Catalog home (catalog.ts)

18 genre rails, 30 items each, using `getRailLight` (single TMDB call per rail, no per-item detail fetches). Full details only fetched on the title detail screen.
