import type { LordMode } from "@/lib/ai/models";
import {
  CHAT_MODEL_MAP,
  LORD_IDENTITY,
  buildRouteDecision,
  classifyTask,
  findBestFreeModel,
} from "@/config/lord-config";
import { OpenRouterClient } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { normalizeOpenRouterError } from "@/lib/ai/errors";
import type { ChatMessage } from "@/lib/ai/types";

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

export async function runLordVision(_opts: {
  prompt: string;
  image: string;
  mode?: LordMode;
}): Promise<{ text: string; provider?: string }> {
  throw new Error("AI_NOT_CONFIGURED");
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
