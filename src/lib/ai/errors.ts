export type OpenRouterErrorKind =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limit"
  | "insufficient_credits"
  | "unsupported_model"
  | "malformed_response"
  | "unavailable"
  | "network"
  | "request";

const ERROR_MESSAGES: Record<OpenRouterErrorKind, string> = {
  missing_api_key: "OpenRouter API key is missing.",
  invalid_api_key: "Invalid OpenRouter API key.",
  rate_limit: "OpenRouter rate limit reached.",
  insufficient_credits: "The configured OpenRouter account has insufficient credits.",
  unsupported_model: "The selected model is not available from OpenRouter.",
  malformed_response: "OpenRouter returned an invalid response.",
  unavailable: "OpenRouter is temporarily unavailable.",
  network: "Unable to reach OpenRouter.",
  request: "OpenRouter rejected the request.",
};

export class OpenRouterError extends Error {
  readonly kind: OpenRouterErrorKind;
  readonly status?: number;

  constructor(kind: OpenRouterErrorKind, status?: number, cause?: unknown) {
    super(ERROR_MESSAGES[kind], { cause });
    this.name = "OpenRouterError";
    this.kind = kind;
    this.status = status;
  }
}

export function normalizeOpenRouterError(error: unknown): OpenRouterError {
  if (error instanceof OpenRouterError) return error;
  if (error instanceof TypeError) return new OpenRouterError("network", undefined, error);
  return new OpenRouterError("unavailable", undefined, error);
}

export function errorFromStatus(status: number, cause?: unknown): OpenRouterError {
  if (status === 401 || status === 403) return new OpenRouterError("invalid_api_key", status, cause);
  if (status === 402) return new OpenRouterError("insufficient_credits", status, cause);
  if (status === 429) return new OpenRouterError("rate_limit", status, cause);
  if (status === 404) return new OpenRouterError("unsupported_model", status, cause);
  if (status >= 500) return new OpenRouterError("unavailable", status, cause);
  return new OpenRouterError("request", status, cause);
}
