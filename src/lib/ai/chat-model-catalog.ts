import { CHAT_REGISTRY, PROVIDER_REGISTRY } from "@/config/lord-config";

/** Models explicitly included in the Free tier. New registry entries default to Pro. */
export const FREE_CHAT_MODEL_IDS = Object.freeze([
  "cohere/north-mini-code:free",
  "google/gemma-3-27b-it",
] as const);
const FREE_MODEL_SET: ReadonlySet<string> = new Set(FREE_CHAT_MODEL_IDS);

export function isFreeChatModel(modelId: string): boolean {
  return FREE_MODEL_SET.has(modelId);
}

export function hasChatModelAccess(modelId: string, isPro: boolean): boolean {
  return isFreeChatModel(modelId) || isPro;
}

export function getAccessibleChatModelIds(modelIds: readonly string[], isPro: boolean): string[] {
  return modelIds.filter((id) => hasChatModelAccess(id, isPro));
}

export const CHAT_MODEL_CATALOG = CHAT_REGISTRY.filter((model) => model.supports.includes("chat"))
  .map((model) => ({
    id: model.id,
    label: model.label,
    provider: model.provider,
    providerLabel: PROVIDER_REGISTRY[model.provider].label,
    vision: model.capabilities.supportsVision,
    reasoning: model.capabilities.supportsReasoning,
    coding: model.metadata.tags.includes("coding"),
    proOnly: !isFreeChatModel(model.id),
    capabilities: [
      model.capabilities.supportsVision ? "Vision" : null,
      model.capabilities.supportsReasoning ? "Reasoning" : null,
      model.metadata.tags.includes("coding") ? "Coding" : null,
      `up to ${Math.round(model.limits.maxContextTokens / 1000)}K context`,
    ]
      .filter(Boolean)
      .join(" · "),
  }))
  .sort((left, right) => {
    const leftModel = CHAT_REGISTRY.find((model) => model.id === left.id);
    const rightModel = CHAT_REGISTRY.find((model) => model.id === right.id);
    return (leftModel?.metadata.priority ?? 99) - (rightModel?.metadata.priority ?? 99);
  });

export const FREE_CHAT_MODELS = CHAT_MODEL_CATALOG.filter((model) => !model.proOnly);
export type FreeChatModel = (typeof FREE_CHAT_MODELS)[number];
export type ChatModelCatalogItem = (typeof CHAT_MODEL_CATALOG)[number] & {
  available: boolean;
  unavailableReason?: string;
  providerStatus:
    | "checking"
    | "missing_credentials"
    | "available"
    | "unsupported_model"
    | "invalid_credentials"
    | "insufficient_credits"
    | "rate_limited"
    | "timeout"
    | "malformed_response"
    | "unavailable"
    | "cooldown";
};
