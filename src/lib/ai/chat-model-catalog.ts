import { CHAT_REGISTRY, PROVIDER_REGISTRY } from "@/config/lord-config";

/** Client-safe metadata for models that currently have zero token pricing. */
export const FREE_CHAT_MODELS = CHAT_REGISTRY.filter(
  (model) =>
    model.enabled &&
    model.supports.includes("chat") &&
    model.pricing.inputPer1MTokens === 0 &&
    model.pricing.outputPer1MTokens === 0,
)
  .map((model) => ({
    id: model.id,
    label: model.label,
    provider: model.provider,
    providerLabel: PROVIDER_REGISTRY[model.provider].label,
    vision: model.capabilities.supportsVision,
    reasoning: model.capabilities.supportsReasoning,
    coding: model.metadata.tags.includes("coding"),
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

export type FreeChatModel = (typeof FREE_CHAT_MODELS)[number];
