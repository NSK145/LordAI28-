import {
  CHAT_REGISTRY,
  DEFAULT_MODEL_ID as CONFIG_DEFAULT_MODEL_ID,
  LORD_MODES as CONFIGURED_LORD_MODES,
  LORD_MODELS as CONFIGURED_LORD_MODELS,
} from "@/config/lord-config";
import type { AIModel, ModelInfo } from "./types";

export type { LordMode } from "@/config/lord-config";
import type { LordMode } from "@/config/lord-config";

export const LORD_MODES = CONFIGURED_LORD_MODES;

export const MODELS = Object.freeze({
  DEFAULT: CONFIG_DEFAULT_MODEL_ID,
});

export const MODEL_REGISTRY: readonly ModelInfo[] = Object.freeze(
  CHAT_REGISTRY.map((model) => ({
    id: model.id,
    label: model.label,
    provider: model.provider,
    supportsStreaming: model.capabilities.supportsStreaming,
    supports: ["chat"] as const,
    description: model.description,
  })),
);

export const DEFAULT_MODEL_ID = CONFIG_DEFAULT_MODEL_ID;

export const LORD_MODELS: Readonly<Record<LordMode, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    CONFIGURED_LORD_MODES.map((mode) => [
      mode,
      CONFIGURED_LORD_MODELS[mode].map((candidate) => candidate.modelId),
    ]),
  ) as unknown as Record<LordMode, readonly string[]>,
);

export function getModel(modelId?: string): AIModel {
  return MODEL_REGISTRY.find((model) => model.id === modelId) ?? MODEL_REGISTRY[0];
}
