export type OpenRouterHealthStatus =
  | "available"
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited"
  | "timeout"
  | "malformed_response"
  | "unavailable";

export interface OpenRouterHealthResult {
  ok: boolean;
  status: OpenRouterHealthStatus;
  modelIds: string[];
  checkedAt: string;
}

export type OpenRouterModelStatus =
  | "available"
  | "unsupported_model"
  | "invalid_credentials"
  | "insufficient_credits"
  | "rate_limited"
  | "timeout"
  | "malformed_response"
  | "unavailable";

export interface OpenRouterModelProbeResult {
  modelId: string;
  status: OpenRouterModelStatus;
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
    if (!response.ok) {
      return {
        ok: false,
        status: healthStatusForHttp(response.status),
        modelIds: [],
        checkedAt,
      };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, status: "malformed_response", modelIds: [], checkedAt };
    }
    if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
      return { ok: false, status: "malformed_response", modelIds: [], checkedAt };
    }
    const known = new Set(knownModelIds);
    const modelIds = body.data
      .map((model: unknown) =>
        model && typeof model === "object" && "id" in model ? model.id : null,
      )
      .filter((id): id is string => typeof id === "string" && (known.size === 0 || known.has(id)))
      .slice(0, 250);
    return { ok: true, status: "available", modelIds, checkedAt };
  } catch (error) {
    const status: OpenRouterHealthStatus = isTimeout(error) ? "timeout" : "unavailable";
    return { ok: false, status, modelIds: [], checkedAt };
  }
}

export async function probeOpenRouterModel(
  apiKey: string | undefined,
  modelId: string,
  fetcher: typeof fetch = fetch,
): Promise<OpenRouterModelProbeResult> {
  const checkedAt = new Date().toISOString();
  if (!apiKey?.trim()) return { modelId, status: "invalid_credentials", checkedAt };

  try {
    const response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lordai.app",
        "X-Title": "LordAI availability check",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Reply with OK." }],
        stream: false,
        max_tokens: 2,
      }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return { modelId, status: modelStatusForHttp(response.status), checkedAt };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { modelId, status: "malformed_response", checkedAt };
    }
    if (response.ok && isValidCompletion(body)) {
      return { modelId, status: "available", checkedAt };
    }
    return { modelId, status: "malformed_response", checkedAt };
  } catch (error) {
    return { modelId, status: isTimeout(error) ? "timeout" : "unavailable", checkedAt };
  }
}

function healthStatusForHttp(status: number): OpenRouterHealthStatus {
  if (status === 401 || status === 403) return "invalid_credentials";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

function modelStatusForHttp(status: number): OpenRouterModelStatus {
  if (status === 401 || status === 403) return "invalid_credentials";
  if (status === 402) return "insufficient_credits";
  if (status === 404) return "unsupported_model";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isValidCompletion(body: unknown): boolean {
  if (!body || typeof body !== "object" || !("choices" in body) || !Array.isArray(body.choices)) {
    return false;
  }
  const choice = body.choices[0];
  return Boolean(choice && typeof choice === "object" && "message" in choice);
}
