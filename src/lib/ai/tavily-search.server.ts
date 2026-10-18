import "@tanstack/react-start/server-only";
import { readEnvApiKey } from "../env.server";
import type { WebSource } from "./web-sources";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const MAX_CONTENT_CHARS = 1_200;
export const MAX_WEB_QUERY_LENGTH = 500;
export const MAX_WEB_RESULTS = 20;
export type TavilySearchDepth = "basic" | "advanced";

const WEB_SEARCH_WINDOW_MS = 60_000;
const WEB_SEARCH_MAX_PER_USER = 10;
const webSearchRequests = new Map<string, number[]>();

export function readTavilyApiKey(
  readKey: () => string | undefined = () => readEnvApiKey("TAVILY_API_KEY"),
): string | undefined {
  return readKey()?.trim() || undefined;
}

export class WebSearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WebSearchError";
  }
}

/** Best-effort per-instance limit; user IDs are never logged or persisted. */
export function checkWebSearchRateLimit(userId: string, now = Date.now()): boolean {
  const recent = (webSearchRequests.get(userId) ?? []).filter(
    (at) => now - at < WEB_SEARCH_WINDOW_MS,
  );
  if (recent.length >= WEB_SEARCH_MAX_PER_USER) {
    webSearchRequests.set(userId, recent);
    return false;
  }
  recent.push(now);
  webSearchRequests.set(userId, recent);
  if (webSearchRequests.size > 5_000) {
    for (const [key, timestamps] of webSearchRequests) {
      if (timestamps.every((at) => now - at >= WEB_SEARCH_WINDOW_MS)) webSearchRequests.delete(key);
    }
  }
  return true;
}

/** Search Tavily server-side; the API key is sent only in the Authorization header. */
export async function searchWebSources(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
  options: { searchDepth?: TavilySearchDepth; maxResults?: number } = {},
): Promise<WebSource[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length > MAX_WEB_QUERY_LENGTH) {
    throw new WebSearchError(
      `Search query must be between 1 and ${MAX_WEB_QUERY_LENGTH} characters.`,
      400,
    );
  }

  const maxResults = Math.min(MAX_WEB_RESULTS, Math.max(1, Math.floor(options.maxResults ?? 5)));
  const searchDepth = options.searchDepth ?? "basic";
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      query: normalizedQuery,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: false,
      include_favicon: false,
    }),
    signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(8_000)]),
  });
  if (!response.ok) {
    throw new WebSearchError(
      response.status === 429 || response.status === 432 || response.status === 433
        ? "Web search has reached its current Tavily usage limit. Check your Tavily plan or try again later."
        : response.status === 401
          ? "Web search could not authenticate with Tavily. Check the server API key."
          : "Web search is temporarily unavailable. Please retry.",
      response.status,
    );
  }

  const payload: unknown = await response.json();
  const results =
    payload && typeof payload === "object" ? (payload as { results?: unknown }).results : null;
  if (!Array.isArray(results)) return [];
  return results
    .flatMap((item): WebSource[] => {
      if (!item || typeof item !== "object") return [];
      const result = item as Record<string, unknown>;
      const title =
        typeof result.title === "string" && result.title.trim()
          ? result.title.slice(0, 240)
          : "Source";
      const url = safeHttpUrl(result.url);
      const content =
        typeof result.content === "string" ? result.content.slice(0, MAX_CONTENT_CHARS) : "";
      if (!url || !content) return [];
      const domain = new URL(url).hostname.replace(/^www\./, "");
      return [
        {
          title,
          url,
          content,
          domain,
          ...(typeof result.score === "number" && Number.isFinite(result.score)
            ? { score: result.score }
            : {}),
          ...(typeof result.published_date === "string"
            ? { publishedDate: result.published_date.slice(0, 40) }
            : {}),
        },
      ];
    })
    .slice(0, maxResults);
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
