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
  seasons?: Array<{
    id: number;
    name?: string;
    overview?: string;
    season_number: number;
    episode_count?: number;
    air_date?: string | null;
    poster_path?: string | null;
  }>;
  external_ids?: { imdb_id?: string | null };
};

type TmdbSeason = {
  season_number: number;
  name?: string;
  overview?: string;
  episode_count?: number;
  air_date?: string | null;
  poster_path?: string | null;
  episodes?: Array<{
    episode_number: number;
    name?: string;
    overview?: string;
    air_date?: string | null;
    runtime?: number | null;
    still_path?: string | null;
  }>;
};

const router: IRouter = Router();
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const cache = new Map<string, { expiresAt: number; value: unknown }>();
const MAX_DISCOVER_PAGE = 500;

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

function normalize(
  item: TmdbListItem & { media_type?: MediaType },
  details?: TmdbDetails,
  seasonDetails: TmdbSeason[] = [],
) {
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
    seasonsData: seasonDetails.map((season) => ({
      seasonNumber: season.season_number,
      name: season.name ?? `Season ${season.season_number}`,
      overview: season.overview ?? "",
      episodeCount: season.episode_count ?? season.episodes?.length ?? 0,
      airDate: season.air_date ?? "",
      posterUrl: image(season.poster_path, "w300"),
      episodes: (season.episodes ?? []).map((episode) => ({
        episodeNumber: episode.episode_number,
        title: episode.name ?? `Episode ${episode.episode_number}`,
        overview: episode.overview ?? "",
        airDate: episode.air_date ?? "",
        runtimeMinutes: episode.runtime ?? 0,
        stillUrl: image(episode.still_path, "w780"),
      })),
    })),
    imdbId: details?.external_ids?.imdb_id ?? "",
  };
}

/** Light normalize — uses only list-level data, no extra API call per item. */
function normalizeLight(item: TmdbListItem & { media_type?: MediaType }) {
  const mediaType = item.media_type ?? "movie";
  const title = item.title ?? item.name ?? "Untitled";
  const releaseDate = item.release_date ?? item.first_air_date ?? "";
  return {
    id: item.id,
    mediaType,
    title,
    originalTitle: item.original_title ?? item.original_name ?? title,
    overview: item.overview ?? "No synopsis available.",
    releaseDate,
    year: releaseDate.slice(0, 4),
    genres: [] as string[],
    cast: [] as string[],
    posterUrl: image(item.poster_path, "w500"),
    backdropUrl: image(item.backdrop_path, "w1280"),
    stillUrls: [] as string[],
    rating: Number((item.vote_average ?? 0).toFixed(1)),
    runtimeMinutes: 0,
    seasons: 0,
    seasonsData: [] as never[],
    imdbId: "",
  };
}

async function getDetails(item: TmdbListItem, includeEpisodes = false) {
  const mediaType = item.media_type ?? "movie";
  const details = await tmdb<TmdbDetails>(`/${mediaType}/${item.id}`, {
    append_to_response: "credits,images,external_ids",
    include_image_language: "en,null",
  });
  const seasonDetails = includeEpisodes && mediaType === "tv"
    ? await Promise.all(
        (details.seasons ?? [])
          .filter((season) => season.season_number > 0)
          .map((season) =>
            tmdb<TmdbSeason>(`/tv/${item.id}/season/${season.season_number}`, {
              append_to_response: "images",
            }),
          ),
      )
    : [];
  return normalize({ ...item, media_type: mediaType }, details, seasonDetails);
}

/** Fetch a rail with full details — use for featured/small rails only. */
async function getRail(path: string, mediaType: MediaType, railSize = 8) {
  const response = await tmdb<{ results: TmdbListItem[] }>(path);
  const items = response.results
    .filter((item) => item.poster_path && item.backdrop_path)
    .slice(0, railSize)
    .map((item) => ({ ...item, media_type: mediaType }));
  return Promise.all(items.map((item) => getDetails(item)));
}

/** Fetch a large rail using list-level data only — single TMDB call, fast. */
async function getRailLight(
  path: string,
  mediaType: MediaType,
  params: Record<string, string> = {},
  railSize = 20,
) {
  const response = await tmdb<{ results: TmdbListItem[] }>(path, params);
  return response.results
    .filter((item) => item.poster_path && item.backdrop_path)
    .slice(0, railSize)
    .map((item) => normalizeLight({ ...item, media_type: mediaType }));
}

/** Fetch two pages of a discover endpoint and combine into a large rail. */
async function getDiscoverRailLight(
  mediaType: MediaType,
  genreId: string,
  railSize = 30,
) {
  const params = {
    sort_by: "popularity.desc",
    include_adult: "false",
    include_video: "false",
    with_genres: genreId,
  };
  const [page1, page2] = await Promise.all([
    tmdb<{ results: TmdbListItem[] }>(`/discover/${mediaType}`, { ...params, page: "1" }),
    tmdb<{ results: TmdbListItem[] }>(`/discover/${mediaType}`, { ...params, page: "2" }),
  ]);
  const combined = [...page1.results, ...page2.results];
  return combined
    .filter((item) => item.poster_path && item.backdrop_path)
    .slice(0, railSize)
    .map((item) => normalizeLight({ ...item, media_type: mediaType }));
}

router.get("/catalog/home", async (_req, res) => {
  const cached = cache.get("home");
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);
  try {
    // Fetch featured item with full details, plus all rails in parallel.
    const [
      trending,
      popularMoviesRail,
      popularSeriesRail,
      newMoviesRail,
      actionMovies,
      comedyMovies,
      horrorMovies,
      scifiMovies,
      crimeMovies,
      animationMovies,
      topRatedMovies,
      topRatedSeries,
      actionSeries,
      dramaMovies,
      documentaryMovies,
      thrillerMovies,
      romanceMovies,
      familyMovies,
    ] = await Promise.all([
      tmdb<{ results: TmdbListItem[] }>("/trending/all/week"),
      getRailLight("/movie/popular", "movie", {}, 30),
      getRailLight("/tv/popular", "tv", {}, 30),
      getRailLight("/movie/now_playing", "movie", {}, 30),
      getDiscoverRailLight("movie", "28", 30),          // Action
      getDiscoverRailLight("movie", "35", 30),          // Comedy
      getDiscoverRailLight("movie", "27", 30),          // Horror
      getDiscoverRailLight("movie", "878", 30),         // Science Fiction
      getDiscoverRailLight("movie", "80", 30),          // Crime
      getDiscoverRailLight("movie", "16", 30),          // Animation
      getRailLight("/movie/top_rated", "movie", {}, 30),
      getRailLight("/tv/top_rated", "tv", {}, 30),
      getDiscoverRailLight("tv", "10759", 30),          // Action & Adventure TV
      getDiscoverRailLight("movie", "18", 30),          // Drama
      getDiscoverRailLight("movie", "99", 30),          // Documentary
      getDiscoverRailLight("movie", "53", 30),          // Thriller
      getDiscoverRailLight("movie", "10749", 30),       // Romance
      getDiscoverRailLight("movie", "10751", 30),       // Family
    ]);

    const featuredItem = trending.results.find((item) => item.backdrop_path && item.poster_path);
    const featured = featuredItem
      ? await getDetails({ ...featuredItem, media_type: featuredItem.media_type ?? "movie" })
      : await getDetails({ ...popularMoviesRail[0], media_type: "movie" } as TmdbListItem);
    if (!featured) throw new Error("Catalog returned no featured title.");

    const trendingRail = trending.results
      .filter((item) => item.poster_path && item.backdrop_path)
      .slice(0, 30)
      .map((item) => normalizeLight({ ...item, media_type: item.media_type ?? "movie" }));

    const value = {
      featured,
      rails: [
        { title: "Popular on StreamBox", items: popularMoviesRail },
        { title: "Trending Now", items: trendingRail },
        { title: "Popular Series", items: popularSeriesRail },
        { title: "New Releases", items: newMoviesRail },
        { title: "Action & Adventure", items: actionMovies },
        { title: "Comedy", items: comedyMovies },
        { title: "Crime", items: crimeMovies },
        { title: "Thriller", items: thrillerMovies },
        { title: "Horror", items: horrorMovies },
        { title: "Science Fiction", items: scifiMovies },
        { title: "Drama", items: dramaMovies },
        { title: "Romance", items: romanceMovies },
        { title: "Animation", items: animationMovies },
        { title: "Family", items: familyMovies },
        { title: "Documentary", items: documentaryMovies },
        { title: "Top Rated Movies", items: topRatedMovies },
        { title: "Top Rated Series", items: topRatedSeries },
        { title: "Action Series", items: actionSeries },
      ],
      syncedAt: new Date().toISOString(),
    };
    cache.set("home", { value, expiresAt: Date.now() + 15 * 60 * 1000 });
    return res.json(value);
  } catch (error) {
    _req.log.error({ err: error }, "catalog sync failed");
    return res.status(502).json({ message: "Catalog sync is temporarily unavailable." });
  }
});

router.get("/catalog/discover", async (req, res) => {
  const mediaType = req.query.type === "tv" ? "tv" : req.query.type === "movie" ? "movie" : null;
  const requestedPage = Number(req.query.page ?? 1);

  if (!mediaType) {
    return res.status(400).json({
      message: "Query parameter type must be movie or tv.",
    });
  }

  if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > MAX_DISCOVER_PAGE) {
    return res.status(400).json({
      message: `Query parameter page must be an integer between 1 and ${MAX_DISCOVER_PAGE}.`,
    });
  }

  const cacheKey = `discover:${mediaType}:${requestedPage}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);

  try {
    const response = await tmdb<{
      page: number;
      total_pages: number;
      total_results: number;
      results: TmdbListItem[];
    }>(`/discover/${mediaType}`, {
      page: String(requestedPage),
      sort_by: "popularity.desc",
      include_adult: "false",
      include_video: "false",
    });

    const items = response.results
      .filter((item) => item.poster_path && item.backdrop_path)
      .map((item) => normalizeLight({ ...item, media_type: mediaType }));

    const totalPages = Math.min(response.total_pages, MAX_DISCOVER_PAGE);
    const value = {
      page: response.page,
      totalPages,
      totalResults: Math.min(response.total_results, totalPages * 20),
      mediaType,
      items,
    };

    cache.set(cacheKey, { value, expiresAt: Date.now() + 10 * 60 * 1000 });
    return res.json(value);
  } catch (error) {
    req.log.error({ err: error, mediaType, page: requestedPage }, "catalog discovery failed");
    return res.status(502).json({ message: "Catalog discovery is temporarily unavailable." });
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
      .slice(0, 30)
      .map((item) => ({ ...item, media_type: item.media_type as MediaType }));
    const value = items.map((item) => normalizeLight(item));
    cache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    return res.json(value);
  } catch (error) {
    req.log.error({ err: error }, "search failed");
    return res.status(502).json({ message: "Search is temporarily unavailable." });
  }
});

router.get("/catalog/title/:id", async (req, res) => {
  const mediaType = req.query.type === "tv" ? "tv" : "movie";
  try {
    const details = await tmdb<TmdbDetails>(`/${mediaType}/${req.params.id}`, {
      append_to_response: "credits,images,external_ids",
      include_image_language: "en,null",
    });
    return res.json(await getDetails({ ...details, media_type: mediaType }, true));
  } catch (error) {
    req.log.error({ err: error }, "title lookup failed");
    return res.status(404).json({ message: "Title not found." });
  }
});

/**
 * GET /catalog/stream/:id?type=movie|tv&season=1&episode=1
 * Returns embed URLs for the given TMDB title from multiple free streaming sources.
 */
router.get("/catalog/stream/:id", async (req, res) => {
  const id = req.params.id;
  const mediaType = req.query.type === "tv" ? "tv" : "movie";
  const season = typeof req.query.season === "string" ? req.query.season : "1";
  const episode = typeof req.query.episode === "string" ? req.query.episode : "1";

  let embedUrls: string[];
  if (mediaType === "tv") {
    embedUrls = [
      `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
      `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
      `https://vidsrc.xyz/embed/tv/${id}?s=${season}&e=${episode}`,
      `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
    ];
  } else {
    embedUrls = [
      `https://vidsrc.to/embed/movie/${id}`,
      `https://vidsrc.me/embed/movie?tmdb=${id}`,
      `https://vidsrc.xyz/embed/movie/${id}`,
      `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    ];
  }

  return res.json({
    id,
    mediaType,
    season: mediaType === "tv" ? season : null,
    episode: mediaType === "tv" ? episode : null,
    embedUrls,
    primaryUrl: embedUrls[0],
  });
});

export default router;
