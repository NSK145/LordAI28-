import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  findBestFreeModel: vi.fn(),
  buildRouteDecision: vi.fn(),
  classifyTask: vi.fn(),
  streamChat: vi.fn(),
  models: new Map<string, unknown>(),
}));

vi.mock("@/config/lord-config", () => ({
  CHAT_MODEL_MAP: router.models,
  CHAT_REGISTRY: [],
  LORD_IDENTITY: { defaultMode: "balanced" },
  buildRouteDecision: router.buildRouteDecision,
  classifyTask: router.classifyTask,
  findBestFreeModel: router.findBestFreeModel,
}));

vi.mock("@/lib/ai/config", () => ({
  getAIConfig: () => ({ openRouterApiKey: "test-key" }),
}));

vi.mock("@/lib/ai/client", () => ({
  OpenRouterClient: class {
    streamChat = router.streamChat;
  },
}));

import { runLordJson, runLordText, runLordVision } from "./llm";

function model(pricing: { inputPer1MTokens: number; outputPer1MTokens: number }) {
  return {
    type: "chat",
    provider: "openrouter",
    pricing,
    limits: { maxOutputTokens: 2048 },
  };
}

describe("free-only agent model routing", () => {
  beforeEach(() => {
    router.findBestFreeModel.mockReset();
    router.buildRouteDecision.mockReset();
    router.classifyTask.mockReset();
    router.streamChat.mockReset();
    router.models.clear();
    router.models.set("free-first", model({ inputPer1MTokens: 0, outputPer1MTokens: 0 }));
    router.models.set("free-fallback", model({ inputPer1MTokens: 0, outputPer1MTokens: 0 }));
    router.models.set("paid-candidate", model({ inputPer1MTokens: 1, outputPer1MTokens: 1 }));
    router.classifyTask.mockReturnValue("planning");
    router.findBestFreeModel.mockReturnValue({ modelId: "free-first", provider: "openrouter" });
    router.buildRouteDecision.mockReturnValue({ candidates: ["free-first", "free-fallback"] });
  });

  it("uses the best free model and passes the requested completion limit", async () => {
    router.streamChat.mockImplementation(async function* () {
      yield "plan ready";
    });

    await expect(
      runLordText({
        system: "Plan safely",
        prompt: "Plan a project",
        mode: "reasoning",
        maxTokens: 700,
      }),
    ).resolves.toMatchObject({ text: "plan ready", provider: "openrouter", modelId: "free-first" });
    expect(router.findBestFreeModel).toHaveBeenCalledWith(
      "Plan a project",
      "planning",
      "reasoning",
    );
    expect(router.streamChat).toHaveBeenCalledWith(expect.any(Array), "free-first", undefined, 700);
  });

  it("forwards execution cancellation to the selected free model request", async () => {
    router.streamChat.mockImplementation(async function* () {
      yield "plan ready";
    });
    const controller = new AbortController();

    await runLordText({
      system: "Plan safely",
      prompt: "Plan a project",
      signal: controller.signal,
    });

    expect(router.streamChat).toHaveBeenCalledWith(
      expect.any(Array),
      "free-first",
      controller.signal,
      2048,
    );
  });

  it("never sends a paid candidate and retries the next free model on network failure", async () => {
    router.buildRouteDecision.mockReturnValue({
      candidates: ["free-first", "paid-candidate", "free-fallback"],
    });
    router.streamChat.mockImplementation(async function* (_messages, modelId: string) {
      if (modelId === "free-first") throw new TypeError("network unavailable");
      yield "fallback response";
    });

    await expect(
      runLordText({ system: "Reason", prompt: "Plan a project" }),
    ).resolves.toMatchObject({
      text: "fallback response",
      provider: "openrouter",
      modelId: "free-fallback",
    });
    const requestedModels = router.streamChat.mock.calls.map((call) => call[1]);
    expect(requestedModels).toEqual(["free-first", "free-fallback"]);
    expect(requestedModels).not.toContain("paid-candidate");
  });

  it("fails cleanly when the free-only router has no healthy model", async () => {
    router.findBestFreeModel.mockReturnValue(null);

    await expect(runLordText({ system: "Reason", prompt: "Plan a project" })).rejects.toThrow(
      "No free model is currently healthy",
    );
    expect(router.streamChat).not.toHaveBeenCalled();
  });

  it("retries malformed structured output with the next free model", async () => {
    router.streamChat.mockImplementation(async function* (_messages, modelId: string) {
      yield modelId === "free-first" ? "not json" : '{"planned":true}';
    });

    await expect(
      runLordJson<{ planned: boolean }>({ system: "Plan", prompt: "Create a plan" }),
    ).resolves.toEqual({ planned: true });
    expect(router.streamChat.mock.calls.map((call) => call[1])).toEqual([
      "free-first",
      "free-fallback",
    ]);
  });

  it("does not claim to analyze images through text-only model input", async () => {
    await expect(
      runLordVision({ prompt: "What is in this image?", image: "data:image/png;base64,x" }),
    ).rejects.toThrow("No vision-capable model is configured.");
    expect(router.streamChat).not.toHaveBeenCalled();
  });
});
