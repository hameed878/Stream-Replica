import { Router, type IRouter } from "express";
import { load } from "cheerio";

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
const HINDIWEB_HOME = "https://hindiweb.com/";
const HINDIWEB_TIMEOUT_MS = 8_000;
const HINDIWEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

class HindiWebResolverError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 404 | 502 = 502,
  ) {
    super(message);
    this.name = "HindiWebResolverError";
  }
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleMatches(candidate: string, requested: string): boolean {
  const candidateWords = new Set(
    candidate
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word && word !== "dubbed"),
  );
  const requestedWords = requested
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return (
    requestedWords.length > 0 &&
    requestedWords.every((word) => candidateWords.has(word))
  );
}

async function resolveHindiWebVideo(requestedTitle: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HINDIWEB_TIMEOUT_MS);

  try {
    const homeResponse = await fetch(HINDIWEB_HOME, {
      signal: controller.signal,
      headers: { "User-Agent": HINDIWEB_USER_AGENT },
    });

    const finalHost = new URL(homeResponse.url).hostname;
    if (
      !homeResponse.ok ||
      !["hindiweb.com", "www.hindiweb.com"].includes(finalHost)
    ) {
      throw new HindiWebResolverError(
        "HindiWeb is unavailable or redirected to another site.",
      );
    }

    const homepageHtml = await homeResponse.text();
    const $ = load(homepageHtml);
    const candidates: Array<{ title: string; url: string }> = [];

    $("a[href]").each((_index, element) => {
      const title = normalizedText($(element).text());
      const rawHref = $(element).attr("href");
      if (!rawHref) return;

      const searchable = `${title} ${rawHref}`.toLowerCase();
      if (!searchable.includes("dubbed")) return;

      try {
        const url = new URL(rawHref, homeResponse.url).toString();
        if (url.startsWith("http://") || url.startsWith("https://")) {
          candidates.push({ title: title || requestedTitle, url });
        }
      } catch {
        // Ignore malformed links from the upstream page.
      }
    });

    const matchingCandidate =
      candidates.find((candidate) =>
        titleMatches(candidate.title, requestedTitle),
      ) ?? candidates.find((candidate) =>
        titleMatches(candidate.url, requestedTitle),
      );

    if (!matchingCandidate) {
      throw new HindiWebResolverError(
        `No HindiWeb Dubbed entry matched "${requestedTitle}".`,
        404,
      );
    }

    const detailResponse = await fetch(matchingCandidate.url, {
      signal: controller.signal,
      headers: { "User-Agent": HINDIWEB_USER_AGENT },
    });
    if (!detailResponse.ok) {
      throw new HindiWebResolverError(
        `HindiWeb detail page returned HTTP ${detailResponse.status}.`,
      );
    }

    const detailHtml = await detailResponse.text();
    const detail$ = load(detailHtml);
    const player = detail$("div.player, .player").first();
    if (player.length === 0) {
      throw new HindiWebResolverError(
        "The HindiWeb entry has no .player container.",
        404,
      );
    }

    let iframeUrl: string | undefined;
    player.find("iframe, embed, video, source").each((_index, element) => {
      if (iframeUrl) return;
      for (const attribute of ["src", "data-src", "data-url", "data-embed"]) {
        const value = detail$(element).attr(attribute)?.trim();
        if (value) {
          iframeUrl = new URL(value, detailResponse.url).toString();
          break;
        }
      }
    });

    if (!iframeUrl) {
      for (const attribute of ["data-src", "data-url", "data-embed"]) {
        const value = player.attr(attribute)?.trim();
        if (value) {
          iframeUrl = new URL(value, detailResponse.url).toString();
          break;
        }
      }
    }

    if (!iframeUrl) {
      throw new HindiWebResolverError(
        "The HindiWeb .player container has no video iframe URL.",
        404,
      );
    }

    return {
      source: "HindiWeb",
      title: matchingCandidate.title,
      primaryUrl: iframeUrl,
      detailUrl: matchingCandidate.url,
    };
  } catch (error) {
    if (error instanceof HindiWebResolverError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new HindiWebResolverError(
        "HindiWeb took too long to return a video stream.",
      );
    }
    throw new HindiWebResolverError(
      "HindiWeb could not be reached right now.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

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
 * GET /catalog/stream/:id?type=movie|tv&title=...
 * Resolves the matching HindiWeb Dubbed entry and returns its .player iframe.
 */
router.get("/catalog/stream/:id", async (req, res) => {
  const id = req.params.id;
  const mediaType = req.query.type === "tv" ? "tv" : "movie";
  const requestedTitle =
    typeof req.query.title === "string" ? req.query.title.trim() : "";

  if (!requestedTitle) {
    return res.status(400).json({ message: "A title is required." });
  }

  try {
    const stream = await resolveHindiWebVideo(requestedTitle);
    return res.json({ id, mediaType, ...stream });
  } catch (error) {
    const statusCode =
      error instanceof HindiWebResolverError ? error.statusCode : 502;
    const message =
      error instanceof Error ? error.message : "HindiWeb stream unavailable.";
    req.log.warn({ err: error, title: requestedTitle }, "HindiWeb stream lookup failed");
    return res.status(statusCode).json({ message });
  }
});

export default router;
