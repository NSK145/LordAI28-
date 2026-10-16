export type OpenRouterHealthStatus =
  | "available"
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited"
  | "timeout"
  | "unavailable";

export interface OpenRouterHealthResult {
  ok: boolean;
  status: OpenRouterHealthStatus;
  modelIds: string[];
  checkedAt: string;
}

export async function checkOpenRouterHealth(
  apiKey: string | undefined,
  fetcher: typeof fetch = fetch,
  knownModelIds: readonly string[] = [],
): Promise<OpenRouterHealthResult> {
  const checkedAt = new Date().toISOString();
  if (!apiKey?.trim()) {
    return { ok: false, status: "missing_credentials", modelIds: [], checkedAt };
  }

  try {
    const response = await fetcher("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    const body: unknown = response.ok ? await response.json() : null;
    const known = new Set(knownModelIds);
    const modelIds =
      body && typeof body === "object" && "data" in body && Array.isArray(body.data)
        ? body.data
            .map((model: unknown) =>
              model && typeof model === "object" && "id" in model ? model.id : null,
            )
            .filter(
              (id): id is string => typeof id === "string" && (known.size === 0 || known.has(id)),
            )
            .slice(0, 250)
        : [];
    const status: OpenRouterHealthStatus = response.ok
      ? "available"
      : response.status === 429
        ? "rate_limited"
        : response.status === 401 || response.status === 403
          ? "invalid_credentials"
          : "unavailable";
    return { ok: response.ok, status, modelIds, checkedAt };
  } catch (error) {
    const status: OpenRouterHealthStatus =
      error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unavailable";
    return { ok: false, status, modelIds: [], checkedAt };
  }
}
