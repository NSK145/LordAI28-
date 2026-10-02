import { describe, expect, it } from "vitest";
import {
  classifyTask,
  buildRouteDecision,
  CHAT_MODEL_MAP,
  findBestFreeModel,
  ROUTING_WEIGHTS,
  type TaskType,
} from "@/config/lord-config";

describe("lord intelligent routing", () => {
  it("classifies coding tasks", () => {
    expect(classifyTask("Build me a React dashboard and debug a failing hook")).toBe("coding");
  });

  it("prefers free models and ignores paid ones", () => {
    const choice = findBestFreeModel("Build me a React dashboard", "coding");
    expect(choice).not.toBeNull();
    expect(choice?.provider).toBe("openrouter");
    expect(choice?.modelId).toContain(":free");
  });

  it("keeps the complete ranked fallback chain restricted to zero-cost chat models", () => {
    const decision = buildRouteDecision("Explain how a binary search works", "balanced");

    expect(decision.candidates.length).toBeGreaterThan(0);
    for (const modelId of decision.candidates) {
      const model = CHAT_MODEL_MAP.get(modelId);
      expect(model?.pricing.inputPer1MTokens).toBe(0);
      expect(model?.pricing.outputPer1MTokens).toBe(0);
    }
  });

  it("uses only registered zero-cost vision models in the image fallback chain", () => {
    const imageCandidates = [
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
    ];

    for (const modelId of imageCandidates) {
      const model = CHAT_MODEL_MAP.get(modelId);
      expect(model?.capabilities.supportsVision).toBe(true);
      expect(model?.pricing.inputPer1MTokens).toBe(0);
      expect(model?.pricing.outputPer1MTokens).toBe(0);
    }
  });

  it("exposes configurable scoring weights", () => {
    expect(ROUTING_WEIGHTS.codingWeight).toBeGreaterThan(0);
    expect(ROUTING_WEIGHTS.latencyPenalty).toBeGreaterThan(0);
    expect(ROUTING_WEIGHTS.healthWeight).toBeGreaterThan(0);
  });

  it("returns a typed task classification", () => {
    const task: TaskType = classifyTask("Write a short story about a city at night");
    expect(task).toBe("creative");
  });
});
