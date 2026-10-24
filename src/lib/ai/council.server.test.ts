import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_MODEL_MAP } from "@/config/lord-config";
import { OpenRouterError } from "./errors";
import {
  claimCouncilQuota,
  clearCouncilQuotaForTests,
  collectCouncilResponse,
  estimateCouncilCostUsd,
  getCouncilProviderHealth,
  isSimpleCouncilTask,
  selectCouncilModels,
  type CouncilLimits,
} from "./council.server";
import type { ChatMessage } from "./types";

const limits: CouncilLimits = {
  maxParallelRequests: 3,
  maxRetries: 0,
  maxOutputTokens: 100,
  timeoutMs: 1_000,
  maxCostUsd: 0.05,
  requestsPerMinute: 2,
};
const messages: ChatMessage[] = [{ role: "user", content: "Compare both implementation options." }];

function streamFor(response: (model: string, call: number) => string | Error) {
  let call = 0;
  return {
    calls: () => call,
    async *streamChatEvents(_messages: readonly ChatMessage[], model: string) {
      const result = response(model, call++);
      if (result instanceof Error) throw result;
      yield { type: "text" as const, delta: result };
    },
  };
}

describe("LORD Council", () => {
  beforeEach(() => clearCouncilQuotaForTests());

  it("respects the Free model allowlist and chooses distinct configured models", () => {
    const selected = selectCouncilModels([...CHAT_MODEL_MAP.keys()], false, "coding");
    expect(selected.map((model) => model.id).sort()).toEqual(
      ["cohere/north-mini-code:free", "google/gemma-3-27b-it"].sort(),
    );
    expect(selectCouncilModels(["google/gemma-3-27b-it"], false, "general")).toHaveLength(1);
  });

  it("does not spend Council calls on straightforward general requests", () => {
    expect(isSimpleCouncilTask("Hello, what can you do?", "general")).toBe(true);
    expect(
      isSimpleCouncilTask("Compare the two choices and explain the trade-offs.", "general"),
    ).toBe(false);
    expect(isSimpleCouncilTask("Implement this feature.", "coding")).toBe(false);
  });

  it("labels a one-model response as reduced mode", async () => {
    const model = CHAT_MODEL_MAP.get("cohere/north-mini-code:free");
    if (!model) throw new Error("Expected registered Free model.");
    const client = streamFor(() => "A single-model answer.");
    const result = await collectCouncilResponse(
      messages,
      [model],
      "general",
      new AbortController().signal,
      limits,
      client as never,
    );
    expect(result.mode).toBe("reduced");
    expect(result.roles).toHaveLength(1);
    expect(result.finalAnswer).toBe("A single-model answer.");
    expect(client.calls()).toBe(1);
  });

  it("caps the estimated cost using configured model pricing", () => {
    const models = selectCouncilModels(
      ["cohere/north-mini-code:free", "google/gemma-3-27b-it"],
      false,
      "general",
    );
    const estimated = estimateCouncilCostUsd(models, 12_000, 400);
    expect(estimated).toBeGreaterThan(0);
    expect(estimateCouncilCostUsd(models, 12_000, 400, 1)).toBe(estimated * 2);
    expect(estimateCouncilCostUsd([models[0]], 100, 100)).toBe(0);
  });

  it("keeps one failed provider visible and still synthesizes the successful contribution", async () => {
    const models = selectCouncilModels(
      ["cohere/north-mini-code:free", "google/gemma-3-27b-it"],
      false,
      "general",
    );
    const client = streamFor((_model, call) =>
      call === 0
        ? "Use the first approach."
        : call === 1
          ? new Error("provider failed")
          : call === 2
            ? "The second provider failed."
            : "Use the successful approach and note the failed reviewer.",
    );
    const result = await collectCouncilResponse(
      messages,
      models,
      "general",
      new AbortController().signal,
      limits,
      client as never,
    );
    expect(result.status).toBe("completed");
    expect(result.contributions.some((item) => item.status === "failed")).toBe(true);
    expect(result.finalAnswer).toContain("successful approach");
  });

  it("retries a transient provider rate limit only within the configured retry budget", async () => {
    const models = selectCouncilModels(
      ["cohere/north-mini-code:free", "google/gemma-3-27b-it"],
      false,
      "general",
    );
    const client = streamFor((_model, call) =>
      call === 0
        ? new OpenRouterError("rate_limit", 429)
        : call === 1
          ? "First independent answer."
          : call === 2
            ? "Second independent answer."
            : call === 3
              ? "No critical issues."
              : "Synthesized final answer.",
    );
    await collectCouncilResponse(
      messages,
      models,
      "general",
      new AbortController().signal,
      { ...limits, maxRetries: 1 },
      client as never,
    );
    expect(client.calls()).toBe(5);
  });

  it("reports contradictory positions for side-by-side review", async () => {
    const models = selectCouncilModels(
      ["cohere/north-mini-code:free", "google/gemma-3-27b-it"],
      false,
      "general",
    );
    const client = streamFor((_model, call) => {
      if (call === 0) return "You should use a cache for this workload.";
      if (call === 1) return "You should not use a cache; it adds complexity.";
      if (call === 2) return "The model outputs conflict on caching.";
      return "Choose based on measured workload.";
    });
    const result = await collectCouncilResponse(
      messages,
      models,
      "general",
      new AbortController().signal,
      limits,
      client as never,
    );
    expect(result.disagreements.length).toBeGreaterThan(0);
    expect(result.contributions.map((item) => item.role)).toContain("Critic");
  });

  it("stops work when the request is cancelled", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("Cancelled", "AbortError"));
    const models = selectCouncilModels(
      ["cohere/north-mini-code:free", "google/gemma-3-27b-it"],
      false,
      "general",
    );
    await expect(
      collectCouncilResponse(
        messages,
        models,
        "general",
        controller.signal,
        limits,
        streamFor(() => "unused") as never,
      ),
    ).rejects.toThrow("Cancelled");
  });

  it("enforces a per-user request limit", () => {
    expect(claimCouncilQuota("user-1", 2, 1_000)).toBe(true);
    expect(claimCouncilQuota("user-1", 2, 1_001)).toBe(true);
    expect(claimCouncilQuota("user-1", 2, 1_002)).toBe(false);
    expect(claimCouncilQuota("user-2", 2, 1_002)).toBe(true);
  });

  it("caches safe provider model availability without retaining credentials", async () => {
    const providerFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "cohere/north-mini-code:free" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const ids = ["cohere/north-mini-code:free"];
    try {
      const first = await getCouncilProviderHealth("server-secret", ids);
      const second = await getCouncilProviderHealth("server-secret", ids);
      expect(first.modelIds).toEqual(second.modelIds);
      expect(providerFetch).toHaveBeenCalledTimes(1);
    } finally {
      providerFetch.mockRestore();
    }
  });
});
