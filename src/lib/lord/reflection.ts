import { runLordJson } from "./llm";
import { classifyFailure, type FailureAnalysis } from "./repair";
import type { RiskLevel, ToolResult } from "./types";

export interface ReflectionInput {
  readonly intent: string;
  readonly tool: string;
  readonly risk: RiskLevel;
  readonly attempt: number;
  readonly result: ToolResult;
  readonly failureAnalysis?: FailureAnalysis;
}

export interface ReflectionResult {
  readonly decision: "continue" | "retry" | "stop";
  readonly reason: string;
}

interface RawReflection {
  decision?: unknown;
  reason?: unknown;
}

export async function reflectToolResult(
  input: ReflectionInput,
  signal?: AbortSignal,
): Promise<ReflectionResult> {
  const failureAnalysis = input.failureAnalysis ??
    (!input.result.success ? classifyFailure(input.result) : undefined);
  const retryIsSafe =
    !input.result.success && input.result.recoverable === true && input.risk === "low";
  try {
    const reflection = await runLordJson<RawReflection>({
      system:
        "You are LORD's independent execution reviewer. Evaluate the tool result against the step intent and use the structured failure analysis as the primary diagnosis. Return strict JSON only with decision ('continue', 'retry', or 'stop') and a concise reason. Request retry only for a recoverable failure.",
      prompt: JSON.stringify({
        intent: input.intent,
        tool: input.tool,
        attempt: input.attempt,
        result: {
          success: input.result.success,
          message: input.result.message.slice(0, 1500),
          recoverable: input.result.recoverable ?? false,
          errorCode: input.result.errorCode ?? null,
        },
        failureAnalysis: failureAnalysis ?? null,
      }),
      schemaHint: '{ "decision": "continue|retry|stop", "reason": string }',
      mode: "reasoning",
      maxTokens: 256,
      signal,
    });

    const decision =
      reflection.decision === "retry" && retryIsSafe
        ? "retry"
        : reflection.decision === "stop"
          ? "stop"
          : "continue";
    return {
      decision,
      reason:
        typeof reflection.reason === "string" && reflection.reason.trim()
          ? reflection.reason.trim().slice(0, 300)
          : "Execution result reviewed.",
    };
  } catch {
    return {
      decision: retryIsSafe ? "retry" : "continue",
      reason: "Reflection model was unavailable; using the safe deterministic recovery policy.",
    };
  }
}
