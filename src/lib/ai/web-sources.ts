export interface WebSource {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  domain?: string;
  score?: number;
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
  return `\n\n### Sources\n${sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})${source.domain ? ` — ${source.domain}` : ""}${source.publishedDate ? ` · ${source.publishedDate}` : ""}`).join("\n")}`;
}
