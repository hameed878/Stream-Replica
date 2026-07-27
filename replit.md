# StreamBox

A live streaming catalog mobile app (Expo/React Native) backed by TMDB. Browse trending movies and shows, search the catalog, view title details, and save a personal watchlist.

## Run & Operate

- **API Server workflow** — `PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080)
- **StreamBox workflow** — `PORT=8099 pnpm --filter @workspace/streambox run dev` (port 8099, Expo Metro)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `TMDB_API_KEY` — The Movie Database API key (set in Secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/streambox/app/` — Expo Router screens (`(tabs)/index`, `(tabs)/search`, `(tabs)/my-list`, `detail/[id]`, `player`)
- `artifacts/streambox/components/StreamBox.tsx` — shared UI primitives (Logo, PosterCard, Rail, PlayButton, etc.)
- `artifacts/streambox/hooks/useMyList.tsx` — AsyncStorage-backed watchlist state
- `artifacts/streambox/constants/colors.ts` — design tokens (dark-first palette)
- `artifacts/api-server/src/routes/catalog.ts` — TMDB proxy routes with in-memory cache
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/` — orval-generated React Query hooks + `customFetch`

## Architecture decisions

- **No database yet** — catalog data is fetched live from TMDB and cached in-memory (15 min for home, 5 min for search). My List persists via AsyncStorage on the device.
- **API codegen via Orval** — `lib/api-spec/openapi.yaml` is the contract; generated hooks live in `lib/api-client-react/src/generated/`. Run codegen after any spec change.
- **`customFetch` base URL** — set once in `_layout.tsx` via `setBaseUrl`. Detail and search screens import `customFetch` directly to pass query params (e.g. `?type=tv`) not in the codegen'd hook signatures.
- **Expo domain routing** — the mobile preview uses `REPLIT_EXPO_DEV_DOMAIN`; the API base URL uses `REPLIT_DEV_DOMAIN`. Both are injected into the Expo dev command automatically.

## Product

- **Home** — featured hero title + 4 curated rails (Popular, Trending, Series, New Releases) sourced live from TMDB
- **Search** — debounced full-text search across movies and TV shows
- **Detail** — title page with synopsis, cast, genre badges, stills carousel, play + save actions
- **Player** — full-screen cinematic player UI with play/pause, scrub bar, and skip controls
- **My List** — device-persisted watchlist (AsyncStorage), add/remove from any screen

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Standalone Python video player

`video_player_app.py` is a separate Tkinter desktop app that fetches links
containing “Dubbed” from `https://hindiweb.com/`, resolves the iframe URL from
each linked page’s `.player` element, and opens a selected video in the
default browser.

Run it locally with:

```bash
python -m pip install -r requirements.txt
python video_player_app.py
```

This is a desktop Tkinter program and is not part of the Expo mobile app.
