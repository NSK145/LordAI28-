export interface WebSource {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const MAX_RESULTS = 5;
const MAX_CONTENT_CHARS = 1_200;

/** Search the web through Tavily's free-tier API. The secret stays server-side. */
export async function searchWebSources(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<WebSource[]> {
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: query.slice(0, 500),
      max_results: MAX_RESULTS,
      search_depth: "basic",
      include_answer: false,
    }),
    signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(8_000)]),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Web search has reached its current free quota. Try again later."
        : "Web search is temporarily unavailable.",
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
      const title = typeof result.title === "string" ? result.title.slice(0, 240) : "Source";
      const url = safeHttpUrl(result.url);
      const content =
        typeof result.content === "string" ? result.content.slice(0, MAX_CONTENT_CHARS) : "";
      if (!url || !content) return [];
      return [
        {
          title,
          url,
          content,
          ...(typeof result.published_date === "string"
            ? { publishedDate: result.published_date.slice(0, 40) }
            : {}),
        },
      ];
    })
    .slice(0, MAX_RESULTS);
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

export function buildSourceContext(sources: readonly WebSource[]): string {
  return sources
    .map(
      (source, index) =>
        `[S${index + 1}] ${source.title}\nURL: ${source.url}\nPublished: ${source.publishedDate ?? "not provided"}\nRelevant excerpt: ${source.content}`,
    )
    .join("\n\n");
}

export function buildSourcesFooter(sources: readonly WebSource[]): string {
  if (!sources.length) return "";
  return `\n\n### Sources\n${sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})${source.publishedDate ? ` — ${source.publishedDate}` : ""}`).join("\n")}`;
}
