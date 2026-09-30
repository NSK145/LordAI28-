import { describe, expect, it } from "vitest";
import {
  classifyTask,
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
