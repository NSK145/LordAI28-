import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { getAIConfig, AIConfigurationError } from "./config";
import { OpenRouterClient } from "./client";
import { normalizeOpenRouterError, OpenRouterError } from "./errors";
import { MODELS } from "./models";
import type { ChatMessage } from "./types";

export function streamChat(
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
  candidateModelIds: readonly string[] = [MODELS.DEFAULT],
): Response {
  const startedAt = Date.now();
  const models = candidateModelIds.length > 0 ? candidateModelIds : [MODELS.DEFAULT];

  console.info("Model request started", { model: models[0], candidateCount: models.length });

  let client: OpenRouterClient;
  try {
    const config = getAIConfig();
    client = new OpenRouterClient(config.openRouterApiKey);
  } catch (error) {
    const message =
      error instanceof AIConfigurationError
        ? error.message
        : "OpenRouter is temporarily unavailable.";
    console.error("Model request error", { model: models[0], error: message });
    console.info("Model request completed", {
      model: models[0],
      duration: Date.now() - startedAt,
      status: "error",
    });
    throw error;
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const messageId = crypto.randomUUID();
      let status = "completed";
      let activeModel = models[0];
      let emittedText = false;
      writer.write({ type: "text-start", id: messageId });

      try {
        let completed = false;
        for (const [index, modelId] of models.entries()) {
          activeModel = modelId;
          try {
            for await (const token of client.streamChat(messages, modelId, signal)) {
              if (token) emittedText = true;
              writer.write({ type: "text-delta", id: messageId, delta: token });
            }
            completed = true;
            break;
          } catch (error) {
            const normalized = normalizeOpenRouterError(error);
            const canRetry =
              !emittedText &&
              !signal?.aborted &&
              index < models.length - 1 &&
              (normalized.kind === "network" ||
                normalized.kind === "rate_limit" ||
                normalized.kind === "unavailable");
            if (!canRetry) throw error;
            console.warn("Model candidate failed; trying configured fallback", {
              model: modelId,
              nextModel: models[index + 1],
              error: normalized.message,
            });
          }
        }
        if (!completed) throw new Error("No configured model candidate completed the request.");
        writer.write({ type: "text-end", id: messageId });
      } catch (error) {
        const normalized = normalizeOpenRouterError(error);
        status = "error";
        writer.write({ type: "error", errorText: normalized.message });
        console.error("Model request error", {
          model: activeModel,
          error: normalized.message,
        });
      } finally {
        console.info("Model request completed", {
          model: activeModel,
          duration: Date.now() - startedAt,
          status,
        });
      }
    },
    onError: (error) => normalizeOpenRouterError(error).message,
  });

  return createUIMessageStreamResponse({ stream });
}

export function isAIConfigurationError(error: unknown): error is AIConfigurationError {
  return error instanceof AIConfigurationError;
}

export function isOpenRouterError(error: unknown): error is OpenRouterError {
  return error instanceof OpenRouterError;
}
