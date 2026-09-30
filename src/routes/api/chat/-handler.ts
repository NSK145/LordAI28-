import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { streamChat, isAIConfigurationError, isOpenRouterError } from "@/lib/ai/gateway";
import { OpenRouterError } from "@/lib/ai/errors";
import { apiErrorResponse } from "@/lib/api-error";
import { buildChatContextMessages } from "./-context";
import {
  CHAT_MODEL_MAP,
  DEFAULT_MODEL_ID,
  classifyTask,
  findBestFreeModel,
  getModeCandidates,
  LORD_IDENTITY,
  LORD_SYSTEM_PROMPT,
} from "@/config/lord-config";
import { buildMemoryPrompt } from "./-memory";
import { ChatRequestSchema } from "./-schema";

export function createChatRoute() {
  return createFileRoute("/api/chat")({
    server: {
      middleware: [requireSupabaseRequestAuth],
      handlers: {
        POST: async ({ request, context }) => {
          const requestId = crypto.randomUUID();
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            console.error(
              JSON.stringify({
                event: "chat_request_invalid_json",
                requestId,
                stack: new Error("Invalid JSON request body").stack,
              }),
            );
            return apiErrorResponse(
              400,
              "INVALID_REQUEST",
              "Request body must be valid JSON.",
              requestId,
            );
          }

          const parsed = ChatRequestSchema.safeParse(rawBody);
          if (!parsed.success) {
            console.error(
              JSON.stringify({
                event: "chat_request_validation_failed",
                requestId,
                issues: parsed.error.issues,
                bodyShape: summarizeRequestBody(rawBody),
                stack: new Error("Chat request validation failed").stack,
              }),
            );
            return apiErrorResponse(
              400,
              "INVALID_REQUEST",
              "Please send a valid conversation with 1-100 messages.",
              requestId,
            );
          }

          console.info(
            JSON.stringify({
              event: "chat_request_validated",
              requestId,
              mode: parsed.data.mode ?? "balanced",
              modelId: parsed.data.modelId ?? null,
              bodyShape: summarizeRequestBody(parsed.data),
            }),
          );

          const authContext = context as
            { userId?: string; supabase?: Parameters<typeof buildMemoryPrompt>[0] } | undefined;
          let memoryPrompt = "";
          if (authContext?.userId && authContext.supabase) {
            memoryPrompt = await buildMemoryPrompt(
              authContext.supabase,
              authContext.userId,
              getLastUserText(parsed.data.messages as unknown as UIMessage[]),
              parsed.data.context?.projectId ?? null,
            ).catch(() => "");
          }

          try {
            const mode = parsed.data.mode ?? LORD_IDENTITY.defaultMode;
            const lastUserText = getLastUserText(parsed.data.messages as unknown as UIMessage[]);
            const taskType = classifyTask(lastUserText || "general");
            const bestFreeModel = findBestFreeModel(lastUserText || "general", taskType, mode);
            const modelCandidates = bestFreeModel
              ? [bestFreeModel.modelId]
              : getModeCandidates(mode, parsed.data.modelId)
                  .filter(
                    (candidate) =>
                      candidate.provider === "openrouter" && CHAT_MODEL_MAP.has(candidate.modelId),
                  )
                  .map((candidate) => candidate.modelId);

            if (bestFreeModel === null && modelCandidates.length === 0) {
              return apiErrorResponse(
                503,
                "AI_NOT_CONFIGURED",
                "No free model is currently healthy.",
                requestId,
              );
            }

            const selectedCandidates =
              modelCandidates.length > 0 ? modelCandidates : [DEFAULT_MODEL_ID];
            const contextLimit = Math.min(
              ...selectedCandidates.map(
                (modelId) => CHAT_MODEL_MAP.get(modelId)?.limits.maxContextTokens ?? 8192,
              ),
            );
            const selectedModel = CHAT_MODEL_MAP.get(selectedCandidates[0]);
            const context = parsed.data.context;
            const chatMessages = buildChatContextMessages(
              parsed.data.messages as unknown as UIMessage[],
              {
                systemPrompt: LORD_SYSTEM_PROMPT,
                memoryPrompt,
                contextBudgetTokens: Math.floor(contextLimit * 0.7),
                application: {
                  page: context?.page,
                  workflow: context?.workflow,
                  projectId: context?.projectId,
                  mode,
                  task: taskType,
                  provider: selectedModel?.provider ?? "openrouter",
                  modelId: selectedCandidates[0],
                },
              },
            );

            return streamChat(chatMessages, request.signal, selectedCandidates);
          } catch (error) {
            console.error(
              JSON.stringify({
                event: "chat_request_failed",
                requestId,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              }),
            );
            return apiErrorResponse(
              getGatewayErrorStatus(error),
              getGatewayErrorCode(error),
              getGatewayErrorMessage(error),
              requestId,
            );
          }
        },
      },
    },
  });
}

function summarizeRequestBody(body: unknown) {
  if (!body || typeof body !== "object") return { type: typeof body };
  const value = body as Record<string, unknown>;
  const messages = Array.isArray(value.messages) ? value.messages : [];
  return {
    keys: Object.keys(value),
    messageCount: messages.length,
    messages: messages.map((message) => {
      const item =
        message && typeof message === "object" ? (message as Record<string, unknown>) : {};
      const parts = Array.isArray(item.parts) ? item.parts : [];
      return {
        role: item.role ?? null,
        partTypes: parts.map((part) =>
          part && typeof part === "object"
            ? ((part as Record<string, unknown>).type ?? null)
            : null,
        ),
      };
    }),
  };
}

function getGatewayErrorStatus(error: unknown): number {
  if (isAIConfigurationError(error)) return 503;
  if (isOpenRouterError(error)) {
    if (error.kind === "invalid_api_key") return 401;
    if (error.kind === "rate_limit") return 429;
    if (error.kind === "request") return 400;
  }
  return 503;
}

function getGatewayErrorCode(
  error: unknown,
):
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_ERROR"
  | "AI_RATE_LIMITED"
  | "AI_BAD_REQUEST"
  | "AI_UPSTREAM_ERROR" {
  if (isAIConfigurationError(error)) return "AI_NOT_CONFIGURED";
  if (error instanceof OpenRouterError) {
    if (error.kind === "invalid_api_key") return "AI_AUTH_ERROR";
    if (error.kind === "rate_limit") return "AI_RATE_LIMITED";
    if (error.kind === "request") return "AI_BAD_REQUEST";
  }
  return "AI_UPSTREAM_ERROR";
}

function getGatewayErrorMessage(error: unknown): string {
  if (isAIConfigurationError(error)) return error.message;
  if (isOpenRouterError(error)) return error.message;
  return "OpenRouter is temporarily unavailable.";
}

function getLastUserText(messages: UIMessage[]): string {
  const message = [...messages].reverse().find((item) => item.role === "user");
  if (!message) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ");
}
