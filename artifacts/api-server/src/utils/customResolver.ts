import axios, { AxiosError } from "axios";
import { load } from "cheerio";

export type CustomResolverConfig = {
  baseUrl: string;
  searchPath?: string;
  linkSelector?: string;
  linkAttribute?: string;
  itemSelector?: string;
  timeoutMs?: number;
  maxLinks?: number;
  userAgent?: string;
};

export type CustomResolverResult = {
  query: string;
  sourceUrl: string;
  links: string[];
  count: number;
};

export class CustomResolverError extends Error {
  constructor(
    message: string,
    public readonly code: "CONFIGURATION_ERROR" | "UPSTREAM_ERROR" | "PARSING_ERROR",
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "CustomResolverError";
  }
}

const DEFAULT_SEARCH_PATH = "/search?q={query}";
const DEFAULT_LINK_SELECTOR = "a[href]";
const DEFAULT_LINK_ATTRIBUTE = "href";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_LINKS = 50;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCustomResolverConfig(): CustomResolverConfig {
  const baseUrl = process.env.SOURCE_RESOLVER_BASE_URL?.trim();
  if (!baseUrl) {
    throw new CustomResolverError(
      "SOURCE_RESOLVER_BASE_URL is not configured.",
      "CONFIGURATION_ERROR",
      503,
    );
  }

  return {
    baseUrl,
    searchPath: process.env.SOURCE_RESOLVER_SEARCH_PATH?.trim() || DEFAULT_SEARCH_PATH,
    linkSelector:
      process.env.SOURCE_RESOLVER_LINK_SELECTOR?.trim() || DEFAULT_LINK_SELECTOR,
    linkAttribute:
      process.env.SOURCE_RESOLVER_LINK_ATTRIBUTE?.trim() || DEFAULT_LINK_ATTRIBUTE,
    itemSelector: process.env.SOURCE_RESOLVER_ITEM_SELECTOR?.trim() || undefined,
    timeoutMs: positiveInteger(
      process.env.SOURCE_RESOLVER_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    maxLinks: positiveInteger(
      process.env.SOURCE_RESOLVER_MAX_LINKS,
      DEFAULT_MAX_LINKS,
    ),
    userAgent:
      process.env.SOURCE_RESOLVER_USER_AGENT?.trim() ||
      "StreamBox source resolver/1.0",
  };
}

function validateBaseUrl(baseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new CustomResolverError(
      "SOURCE_RESOLVER_BASE_URL must be a valid URL.",
      "CONFIGURATION_ERROR",
      503,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CustomResolverError(
      "SOURCE_RESOLVER_BASE_URL must use HTTP or HTTPS.",
      "CONFIGURATION_ERROR",
      503,
    );
  }

  return parsed;
}

function buildSearchUrl(query: string, config: CustomResolverConfig): URL {
  const baseUrl = validateBaseUrl(config.baseUrl);
  const searchPath = config.searchPath?.trim() || DEFAULT_SEARCH_PATH;
  const encodedQuery = encodeURIComponent(query);
  const renderedPath = searchPath.replaceAll("{query}", encodedQuery);

  try {
    const url = new URL(renderedPath, baseUrl);
    if (!searchPath.includes("{query}")) {
      url.searchParams.set("q", query);
    }
    return url;
  } catch {
    throw new CustomResolverError(
      "SOURCE_RESOLVER_SEARCH_PATH must be a valid relative or absolute URL.",
      "CONFIGURATION_ERROR",
      503,
    );
  }
}

function normalizeLink(rawValue: string, sourceUrl: URL): string | null {
  const value = rawValue.trim();
  if (!value || value.startsWith("#") || value.startsWith("javascript:")) {
    return null;
  }

  try {
    const link = new URL(value, sourceUrl);
    if (link.protocol !== "http:" && link.protocol !== "https:") {
      return null;
    }
    return link.toString();
  } catch {
    return null;
  }
}

function extractLinks(
  html: string,
  sourceUrl: URL,
  config: CustomResolverConfig,
): string[] {
  const $ = load(html);
  const selector = config.linkSelector?.trim() || DEFAULT_LINK_SELECTOR;
  const attribute = config.linkAttribute?.trim() || DEFAULT_LINK_ATTRIBUTE;
  const maxLinks = config.maxLinks ?? DEFAULT_MAX_LINKS;
  const links: string[] = [];
  const seen = new Set<string>();

  const collect = (root: ReturnType<typeof $>) => {
    root.find(selector).each((_index, element) => {
      const rawValue = $(element).attr(attribute);
      const normalized = rawValue ? normalizeLink(rawValue, sourceUrl) : null;
      if (normalized && !seen.has(normalized) && links.length < maxLinks) {
        seen.add(normalized);
        links.push(normalized);
      }
    });
  };

  if (config.itemSelector?.trim()) {
    $(config.itemSelector).each((_index, element) => {
      collect($(element));
    });
  } else {
    collect($.root());
  }

  return links;
}

export async function resolveMediaLinks(
  query: string,
  config: CustomResolverConfig = getCustomResolverConfig(),
): Promise<CustomResolverResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new CustomResolverError(
      "A non-empty query is required.",
      "CONFIGURATION_ERROR",
      400,
    );
  }

  const sourceUrl = buildSearchUrl(normalizedQuery, config);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let response;
  try {
    response = await axios.get<string>(sourceUrl.toString(), {
      responseType: "text",
      timeout: timeoutMs,
      maxContentLength: 5 * 1024 * 1024,
      maxBodyLength: 5 * 1024 * 1024,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": config.userAgent || "StreamBox source resolver/1.0",
      },
    });
  } catch (error) {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    throw new CustomResolverError(
      status
        ? `Configured source returned HTTP ${status}.`
        : "Configured source could not be reached.",
      "UPSTREAM_ERROR",
      502,
    );
  }

  let links: string[];
  try {
    links = extractLinks(response.data, sourceUrl, config);
  } catch {
    throw new CustomResolverError(
      "Configured HTML selectors could not be parsed.",
      "PARSING_ERROR",
      502,
    );
  }

  return {
    query: normalizedQuery,
    sourceUrl: sourceUrl.toString(),
    links,
    count: links.length,
  };
}