import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { getAIConfig, AIConfigurationError } from "./config";
import { OpenRouterClient } from "./client";
import { normalizeOpenRouterError, OpenRouterError } from "./errors";
import { recordModelAttempt } from "./model-availability";
import { createLordError } from "../lord-error";
import { MODELS } from "./models";
import type { ChatMessage } from "./types";
import { buildSourcesFooter, type WebSource } from "./web-sources";

export function streamChat(
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
  candidateModelIds: readonly string[] = [MODELS.DEFAULT],
  requestId = crypto.randomUUID(),
  sources: readonly WebSource[] = [],
): Response {
  const startedAt = Date.now();
  const models = candidateModelIds.length > 0 ? candidateModelIds : [MODELS.DEFAULT];

  const hasImages = messages.some((message) => (message.images?.length ?? 0) > 0);
  console.info("Model request started", {
    requestId,
    model: models[0],
    candidateCount: models.length,
    candidates: models,
    messageCount: messages.length,
    hasImages,
  });

  let client: OpenRouterClient;
  try {
    const config = getAIConfig();
    client = new OpenRouterClient(config.openRouterApiKey);
  } catch (error) {
    const message =
      error instanceof AIConfigurationError
        ? error.message
        : "OpenRouter is temporarily unavailable.";
    console.error("Model request error", { requestId, model: models[0], error: message });
    console.info("Model request completed", {
      requestId,
      model: models[0],
      duration: Date.now() - startedAt,
      status: "error",
    });
    throw error;
  }

  let lastAttemptedModel = models[0];
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
          lastAttemptedModel = modelId;
          const attempt = createModelAttemptSignal(signal, 25_000);
          let attemptEmittedText = false;
          const attemptStartedAt = Date.now();
          console.info("Model attempt started", { requestId, model: modelId, attempt: index + 1 });
          try {
            for await (const token of client.streamChat(messages, modelId, attempt.signal)) {
              if (token) {
                emittedText = true;
                attemptEmittedText = true;
              }
              writer.write({ type: "text-delta", id: messageId, delta: token });
            }
            if (!attemptEmittedText) {
              throw new OpenRouterError("unavailable");
            }
            recordModelAttempt(modelId, { success: true });
            console.info("Model attempt completed", {
              requestId,
              model: modelId,
              attempt: index + 1,
              durationMs: Date.now() - attemptStartedAt,
              status: "completed",
            });
            completed = true;
            break;
          } catch (error) {
            const normalized = normalizeOpenRouterError(error);
            recordModelAttempt(modelId, { success: false, status: normalized.status });
            const canRetry =
              !emittedText &&
              !signal?.aborted &&
              index < models.length - 1 &&
              (normalized.kind === "network" ||
                normalized.kind === "rate_limit" ||
                normalized.kind === "unavailable" ||
                normalized.kind === "request");
            if (!canRetry) throw error;
            console.warn("Model attempt failed", {
              requestId,
              model: modelId,
              nextModel: models[index + 1],
              error: normalized.message,
              status: normalized.status,
              attempt: index + 1,
              durationMs: Date.now() - attemptStartedAt,
              willRetry: canRetry,
            });
          } finally {
            attempt.dispose();
          }
        }
        if (!completed) throw new Error("No configured model candidate completed the request.");
        const sourcesFooter = buildSourcesFooter(sources);
        if (sourcesFooter)
          writer.write({ type: "text-delta", id: messageId, delta: sourcesFooter });
        writer.write({ type: "text-end", id: messageId });
      } catch (error) {
        const normalized = normalizeOpenRouterError(error);
        status = "error";
        writer.write({
          type: "error",
          errorText: JSON.stringify(toLordError(normalized, activeModel, requestId)),
        });
        console.error("Model request error", {
          requestId,
          model: activeModel,
          error: normalized.message,
          status: normalized.status,
        });
      } finally {
        console.info("Model request completed", {
          requestId,
          model: activeModel,
          duration: Date.now() - startedAt,
          status,
        });
      }
    },
    onError: (error) =>
      JSON.stringify(toLordError(normalizeOpenRouterError(error), lastAttemptedModel, requestId)),
  });

  return createUIMessageStreamResponse({ stream });
}

function toLordError(error: OpenRouterError, model: string, requestId: string) {
  const code =
    error.kind === "invalid_api_key"
      ? "AI_AUTH_ERROR"
      : error.kind === "rate_limit"
        ? "AI_RATE_LIMITED"
        : error.kind === "request"
          ? "AI_BAD_REQUEST"
          : error.kind === "missing_api_key"
            ? "AI_NOT_CONFIGURED"
            : "AI_PROVIDER_UNAVAILABLE";
  return createLordError({
    code,
    provider: "openrouter",
    model,
    message: error.message,
    recoverable: error.kind !== "invalid_api_key" && error.kind !== "missing_api_key",
    requestId,
  });
}

function createModelAttemptSignal(
  requestSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(requestSignal?.reason);
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Model request timed out.", "TimeoutError")),
    timeoutMs,
  );

  if (requestSignal?.aborted) {
    abortFromRequest();
  } else {
    requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      requestSignal?.removeEventListener("abort", abortFromRequest);
    },
  };
}

export function isAIConfigurationError(error: unknown): error is AIConfigurationError {
  return error instanceof AIConfigurationError;
}

export function isOpenRouterError(error: unknown): error is OpenRouterError {
  return error instanceof OpenRouterError;
}
