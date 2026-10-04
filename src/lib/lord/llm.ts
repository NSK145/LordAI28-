import type { LordMode } from "@/lib/ai/models";
import {
  CHAT_MODEL_MAP,
  CHAT_REGISTRY,
  LORD_IDENTITY,
  buildRouteDecision,
  classifyTask,
  findBestFreeModel,
} from "@/config/lord-config";
import { OpenRouterClient } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { normalizeOpenRouterError, OpenRouterError } from "@/lib/ai/errors";
import type { ChatFileInput, ChatMessage } from "@/lib/ai/types";

export interface LlmCallOptions {
  system: string;
  prompt: string;
  mode?: LordMode;
  maxTokens?: number;
  excludeModelIds?: readonly string[];
  signal?: AbortSignal;
}

interface RoutedTextCompletion {
  text: string;
  provider?: string;
  modelId: string;
  attemptedModelIds: readonly string[];
}

export async function runLordText(opts: LlmCallOptions): Promise<RoutedTextCompletion> {
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("An agent prompt is required.");

  const mode = opts.mode ?? LORD_IDENTITY.defaultMode;
  const taskType = classifyTask(prompt);
  const best = findBestFreeModel(prompt, taskType, mode);
  if (!best) throw new Error("No free model is currently healthy for agent reasoning.");

  const decision = buildRouteDecision(prompt, mode);
  const excluded = new Set(opts.excludeModelIds ?? []);
  const modelIds = [...new Set([best.modelId, ...decision.candidates])].filter((modelId) => {
    const model = CHAT_MODEL_MAP.get(modelId);
    return (
      !excluded.has(modelId) &&
      model?.type === "chat" &&
      model.pricing.inputPer1MTokens === 0 &&
      model.pricing.outputPer1MTokens === 0
    );
  });
  if (modelIds.length === 0) throw new Error("The free model router returned no valid candidates.");

  const maxTokens = Math.min(
    opts.maxTokens ?? Number.MAX_SAFE_INTEGER,
    ...modelIds.map((modelId) => CHAT_MODEL_MAP.get(modelId)!.limits.maxOutputTokens),
  );
  const messages: readonly ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: prompt },
  ];
  const client = new OpenRouterClient(getAIConfig().openRouterApiKey);
  let lastError: unknown;
  const attemptedModelIds: string[] = [];

  for (const modelId of modelIds) {
    attemptedModelIds.push(modelId);
    try {
      let text = "";
      for await (const chunk of client.streamChat(messages, modelId, opts.signal, maxTokens)) {
        text += chunk;
      }
      if (!text.trim()) throw new Error("The selected free model returned an empty response.");
      return {
        text: text.trim(),
        provider: CHAT_MODEL_MAP.get(modelId)?.provider,
        modelId,
        attemptedModelIds,
      };
    } catch (error) {
      const normalized = normalizeOpenRouterError(error);
      lastError = normalized;
      if (
        normalized.kind !== "network" &&
        normalized.kind !== "rate_limit" &&
        normalized.kind !== "unavailable"
      ) {
        throw normalized;
      }
    }
  }

  throw normalizeOpenRouterError(lastError ?? new Error("All free models failed."));
}

export async function runLordVision(opts: {
  prompt: string;
  image?: string;
  images?: readonly string[];
  files?: readonly ChatFileInput[];
  mode?: LordMode;
  signal?: AbortSignal;
}): Promise<{ text: string; provider?: string; modelId: string }> {
  const prompt = opts.prompt.trim() || "Describe the attached visual material accurately.";
  const images = [...(opts.images ?? []), ...(opts.image ? [opts.image] : [])];
  const files = opts.files ?? [];
  if (images.length === 0 && files.length === 0) {
    throw new Error("At least one image or PDF is required for analysis.");
  }
  if (
    images.length > 4 ||
    images.some((image) => !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image.trim()))
  ) {
    throw new Error("Provide no more than four images as base64 image data URLs.");
  }
  if (
    files.length > 4 ||
    files.some(
      (file) =>
        !file.filename.toLowerCase().endsWith(".pdf") ||
        !file.fileData.startsWith("data:application/pdf;base64,"),
    )
  ) {
    throw new Error("Provide no more than four PDF files as base64 PDF data URLs.");
  }

  let apiKey: string;
  try {
    apiKey = getAIConfig().openRouterApiKey;
  } catch {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const candidates = [...CHAT_REGISTRY]
    .filter(
      (model) =>
        model.enabled &&
        model.capabilities.supportsVision &&
        model.limits.maxImagesPerRequest > 0 &&
        model.pricing.inputPer1MTokens === 0 &&
        model.pricing.outputPer1MTokens === 0 &&
        model.supports.includes("chat"),
    )
    .sort((a, b) => a.metadata.priority - b.metadata.priority);
  if (candidates.length === 0) throw new Error("No vision-capable model is configured.");

  const client = new OpenRouterClient(apiKey);
  let lastError: unknown;
  for (const model of candidates) {
    try {
      let text = "";
      for await (const chunk of client.streamChat(
        [{ role: "user", content: prompt, ...(images.length ? { images } : {}), ...(files.length ? { files } : {}) }],
        model.id,
        opts.signal,
        Math.min(1200, model.limits.maxOutputTokens),
      )) {
        text += chunk;
      }
      if (!text.trim()) throw new Error("The vision model returned an empty response.");
      return { text: text.trim(), provider: model.provider, modelId: model.id };
    } catch (error) {
      const normalized = normalizeOpenRouterError(error);
      lastError = normalized;
      if (
        normalized.kind !== "network" &&
        normalized.kind !== "rate_limit" &&
        normalized.kind !== "unavailable"
      ) {
        throw normalized;
      }
    }
  }

  if (lastError instanceof OpenRouterError) throw lastError;
  throw new Error("All configured vision models failed.", { cause: lastError });
}

export async function runLordJson<T = unknown>(
  opts: LlmCallOptions & { schemaHint?: string },
): Promise<T> {
  const attemptedModelIds = new Set<string>();
  let lastParseError: unknown;
  for (let attempt = 0; attempt < CHAT_MODEL_MAP.size; attempt++) {
    let completion: RoutedTextCompletion;
    try {
      completion = await runLordText({ ...opts, excludeModelIds: [...attemptedModelIds] });
    } catch (error) {
      if (lastParseError) {
        throw new Error("No remaining free model returned valid JSON.", { cause: lastParseError });
      }
      throw error;
    }
    for (const modelId of completion.attemptedModelIds) attemptedModelIds.add(modelId);

    const fencedJson = completion.text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
    try {
      return JSON.parse(fencedJson ?? completion.text) as T;
    } catch (error) {
      lastParseError = error;
      attemptedModelIds.add(completion.modelId);
    }
  }
  throw new Error("Free models did not return valid JSON.", { cause: lastParseError });
}
