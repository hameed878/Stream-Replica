import { Router, type IRouter } from "express";

type MediaType = "movie" | "tv";
type TmdbListItem = {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
};

type TmdbDetails = TmdbListItem & {
  genres?: Array<{ id: number; name: string }>;
  credits?: { cast?: Array<{ name: string }> };
  images?: { stills?: Array<{ file_path?: string | null }> };
  runtime?: number | null;
  number_of_seasons?: number;
  external_ids?: { imdb_id?: string | null };
};

const router: IRouter = Router();
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const cache = new Map<string, { expiresAt: number; value: unknown }>();

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is required for catalog sync.");
  return key;
}

async function tmdb<T>(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function image(path: string | null | undefined, size: string): string {
  return path ? `${IMAGE_BASE}/${size}${path}` : "";
}

function normalize(item: TmdbListItem & { media_type?: MediaType }, details?: TmdbDetails) {
  const mediaType = details?.media_type ?? item.media_type ?? "movie";
  const title = details?.title ?? details?.name ?? item.title ?? item.name ?? "Untitled";
  const originalTitle =
    details?.original_title ??
    details?.original_name ??
    item.original_title ??
    item.original_name ??
    title;
  const releaseDate = details?.release_date ?? details?.first_air_date ?? item.release_date ?? item.first_air_date ?? "";
  return {
    id: item.id,
    mediaType,
    title,
    originalTitle,
    overview: details?.overview ?? item.overview ?? "No synopsis available.",
    releaseDate,
    year: releaseDate.slice(0, 4),
    genres: details?.genres?.map((genre) => genre.name) ?? [],
    cast: details?.credits?.cast?.slice(0, 6).map((person) => person.name) ?? [],
    posterUrl: image(details?.poster_path ?? item.poster_path, "w500"),
    backdropUrl: image(details?.backdrop_path ?? item.backdrop_path, "w1280"),
    stillUrls:
      details?.images?.stills
        ?.map((still) => image(still.file_path, "w780"))
        .filter(Boolean)
        .slice(0, 8) ?? [],
    rating: Number((details?.vote_average ?? item.vote_average ?? 0).toFixed(1)),
    runtimeMinutes: details?.runtime ?? 0,
    seasons: details?.number_of_seasons ?? 0,
    imdbId: details?.external_ids?.imdb_id ?? "",
  };
}

async function getDetails(item: TmdbListItem) {
  const mediaType = item.media_type ?? "movie";
  const details = await tmdb<TmdbDetails>(`/${mediaType}/${item.id}`, {
    append_to_response: "credits,images,external_ids",
    include_image_language: "en,null",
  });
  return normalize({ ...item, media_type: mediaType }, details);
}

async function getRail(path: string, mediaType: MediaType, railSize = 8) {
  const response = await tmdb<{ results: TmdbListItem[] }>(path);
  const items = response.results
    .filter((item) => item.poster_path && item.backdrop_path)
    .slice(0, railSize)
    .map((item) => ({ ...item, media_type: mediaType }));
  return Promise.all(items.map(getDetails));
}

router.get("/catalog/home", async (_req, res) => {
  const cached = cache.get("home");
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);
  try {
    const [trending, popularMovies, popularSeries, newMovies] = await Promise.all([
      tmdb<{ results: TmdbListItem[] }>("/trending/all/week"),
      getRail("/movie/popular", "movie"),
      getRail("/tv/popular", "tv"),
      getRail("/movie/now_playing", "movie"),
    ]);
    const featuredItem = trending.results.find((item) => item.backdrop_path && item.poster_path) ?? popularMovies[0];
    const featured = await getDetails({
      ...featuredItem,
      media_type: featuredItem.media_type ?? "movie",
    });
    const value = {
      featured,
      rails: [
        { title: "Popular on StreamBox", items: popularMovies },
        { title: "Trending Now", items: await Promise.all(
          trending.results
            .filter((item) => item.poster_path && item.backdrop_path)
            .slice(0, 8)
            .map((item) => getDetails({ ...item, media_type: item.media_type ?? "movie" })),
        ) },
        { title: "Series Worth Watching", items: popularSeries },
        { title: "New Releases", items: newMovies },
      ],
      syncedAt: new Date().toISOString(),
    };
    cache.set("home", { value, expiresAt: Date.now() + 15 * 60 * 1000 });
    res.json(value);
  } catch (error) {
    _req.log.error({ err: error }, "catalog sync failed");
    res.status(502).json({ message: "Catalog sync is temporarily unavailable." });
  }
});

router.get("/catalog/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json([]);
  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);
  try {
    const response = await tmdb<{ results: (TmdbListItem & { media_type?: string })[] }>("/search/multi", { query: q });
    const items = response.results
      .filter((item) => (item.media_type === "movie" || item.media_type === "tv") && item.poster_path)
      .slice(0, 20)
      .map((item) => ({ ...item, media_type: item.media_type as MediaType }));
    const value = await Promise.all(items.map(getDetails));
    cache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    res.json(value);
  } catch (error) {
    req.log.error({ err: error }, "search failed");
    res.status(502).json({ message: "Search is temporarily unavailable." });
  }
});

router.get("/catalog/title/:id", async (req, res) => {
  const mediaType = req.query.type === "tv" ? "tv" : "movie";
  try {
    const details = await tmdb<TmdbDetails>(`/${mediaType}/${req.params.id}`, {
      append_to_response: "credits,images,external_ids",
      include_image_language: "en,null",
    });
    res.json(normalize({ ...details, media_type: mediaType }, details));
  } catch (error) {
    req.log.error({ err: error }, "title lookup failed");
    res.status(404).json({ message: "Title not found." });
  }
});

export default router;