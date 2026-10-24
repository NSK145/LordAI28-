import { createFileRoute } from "@tanstack/react-router";
import { CHAT_MODEL_CATALOG } from "@/lib/ai/chat-model-catalog";
import {
  checkOpenRouterHealth,
  probeOpenRouterModel,
  type OpenRouterModelProbeResult,
} from "@/lib/ai/openrouter-health.server";
import { isModelAvailable } from "@/lib/ai/model-availability";
import { readEnvApiKey } from "@/lib/env.server";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { hasProEntitlement } from "@/lib/billing/entitlements.server";

const AVAILABILITY_CACHE_MS = 60_000;
let cachedAvailability:
  | {
      expiresAt: number;
      ok: boolean;
      status: string;
      modelIds: Set<string>;
      probes: Map<string, OpenRouterModelProbeResult>;
    }
  | undefined;

async function getProviderAvailability(
  apiKey: string | undefined,
  knownModelIds: string[],
  forceRefresh = false,
) {
  if (forceRefresh) cachedAvailability = undefined;
  if (cachedAvailability && cachedAvailability.expiresAt > Date.now()) return cachedAvailability;
  const health = await checkOpenRouterHealth(apiKey, fetch, knownModelIds);
  const freeModels = CHAT_MODEL_CATALOG.filter((model) => !model.proOnly);
  const probes = new Map<string, OpenRouterModelProbeResult>();
  if (health.ok && apiKey) {
    const results = await Promise.all(
      freeModels.map((model) => probeOpenRouterModel(apiKey, model.id)),
    );
    for (const result of results) probes.set(result.modelId, result);
  }
  cachedAvailability = {
    expiresAt: Date.now() + AVAILABILITY_CACHE_MS,
    ok: health.ok,
    status: health.status,
    modelIds: new Set(health.modelIds),
    probes,
  };
  return cachedAvailability;
}

function availabilityMessage(status: string): string {
  switch (status) {
    case "missing_credentials":
      return "OpenRouter credentials are not configured on the server.";
    case "invalid_credentials":
      return "OpenRouter rejected the server credentials.";
    case "rate_limited":
      return "OpenRouter is rate limiting availability checks. Retry shortly.";
    case "insufficient_credits":
      return "The configured OpenRouter account has insufficient credits for this model.";
    case "unsupported_model":
      return "OpenRouter does not support this model identifier.";
    case "timeout":
      return "OpenRouter did not respond before the availability check timed out.";
    case "malformed_response":
      return "OpenRouter returned an invalid response during its availability check.";
    case "cooldown":
      return "This model is temporarily cooling down after a provider error.";
    case "unavailable":
      return "The OpenRouter model service is temporarily unavailable.";
    default:
      return "This model is not listed by the configured provider account.";
  }
}

export const Route = createFileRoute("/api/models")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      GET: async ({ context, request }) => {
        const auth = context as {
          userId: string;
          claims: { email?: string; email_confirmed_at?: string | null };
        };
        let isPro = false;
        try {
          isPro = await hasProEntitlement({ id: auth.userId, ...auth.claims });
        } catch (error) {
          console.error(
            "Model catalog entitlement check failed; returning Free access only.",
            error,
          );
        }
        const apiKey = readEnvApiKey("OPENROUTER_API_KEY");
        const knownOpenRouterIds = CHAT_MODEL_CATALOG.filter(
          (model) => model.provider === "openrouter",
        ).map((model) => model.id);
        const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
        const provider = await getProviderAvailability(apiKey, knownOpenRouterIds, forceRefresh);
        const models = CHAT_MODEL_CATALOG.map((model) => {
          const probe = provider.probes.get(model.id);
          const providerStatus =
            model.provider !== "openrouter"
              ? "unavailable"
              : probe
                ? probe.status
                : !provider.ok
                  ? provider.status
                  : !provider.modelIds.has(model.id)
                    ? "unsupported_model"
                    : isModelAvailable(model.id)
                      ? "available"
                      : "cooldown";
          const available = model.provider === "openrouter" && providerStatus === "available";
          return {
            ...model,
            available,
            ...(!available ? { unavailableReason: availabilityMessage(providerStatus) } : {}),
            providerStatus,
          };
        });
        return Response.json(
          { isPro, models },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      },
    },
  },
});
