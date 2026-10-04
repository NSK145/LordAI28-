import { monitoring } from "./monitoring-service";
import { Capacitor } from "@capacitor/core";
import { getApiBaseUrl } from "./api-config";

/**
 * LORD API Interceptor
 * Wraps the global fetch to monitor all outgoing requests.
 */

export function setupApiInterceptor() {
  if (typeof window === "undefined") return;
  if (Reflect.get(window, "__lordFetchInstrumented")) return;

  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const start = Date.now();
    const requestUrl = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    let input = args[0];
    let url = requestUrl;

    if (Capacitor.isNativePlatform() && requestUrl.startsWith("/api/")) {
      const apiBase = getApiBaseUrl();
      if (!apiBase) {
        throw new Error(
          "LORD cannot reach its server from this Android build. Configure VITE_API_BASE_URL with the deployed HTTPS URL and rebuild.",
        );
      }
      url = new URL(requestUrl, `${apiBase}/`).toString();
      input = url;
    }

    const init = args[1] ?? {};
    const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const native = Capacitor.isNativePlatform();
    const safeToRetry = native && (method === "GET" || method === "HEAD");

    try {
      let response: Response | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < (safeToRetry ? 3 : 1); attempt++) {
        try {
          response = native
            ? await fetchWithTimeout(originalFetch, input, init)
            : await originalFetch(input, init);
          if (
            !safeToRetry ||
            ![408, 425, 429, 500, 502, 503, 504].includes(response.status) ||
            attempt === 2
          ) {
            break;
          }
        } catch (error) {
          lastError = error;
          if (init.signal?.aborted || !safeToRetry || attempt === 2) throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
      }
      if (!response) throw lastError ?? new Error("Network request failed");
      const latency = Date.now() - start;

      monitoring.updateLatency(latency);

      if (!response.ok) {
        monitoring.logEvent({
          type: "error",
          category: "api",
          message: `API Failure: ${response.status} ${response.statusText}`,
          metadata: { url, status: response.status, latency },
        });

        if (response.status === 401 || response.status === 403) {
          monitoring.updateStatus("auth", "offline");
        } else if (response.status >= 500) {
          monitoring.updateStatus("api", "degraded");
        }
        monitoring.markFailure(response.status === 429);
      } else {
        monitoring.logEvent({
          type: "api",
          category: "network",
          message: `Successful request to ${url}`,
          metadata: { url, status: response.status, latency },
        });
        monitoring.markSuccess();
      }

      return response;
    } catch (error) {
      const latency = Date.now() - start;
      const message = error instanceof Error ? error.message : "Network request failed";

      monitoring.logEvent({
        type: "error",
        category: "network",
        message,
        metadata: { url, latency },
      });

      monitoring.updateStatus("api", "offline");
      monitoring.markFailure(false);
      throw error;
    }
  };
  Reflect.set(window, "__lordFetchInstrumented", true);
}

async function fetchWithTimeout(
  fetcher: typeof window.fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const requestSignal = init.signal ?? (input instanceof Request ? input.signal : undefined);
  if (requestSignal?.aborted) throw requestSignal.reason;
  const abortFromCaller = () => controller.abort(requestSignal?.reason);
  requestSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(
    () => controller.abort(new Error("Request timed out.")),
    180_000,
  );
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", abortFromCaller);
  }
}
