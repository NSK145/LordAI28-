import { afterEach, describe, expect, it } from "vitest";
import {
  clearModelAvailabilityForTests,
  isModelAvailable,
  preferAvailableModels,
  recordModelAttempt,
} from "./model-availability";

afterEach(() => {
  clearModelAvailabilityForTests();
});

describe("free model availability cache", () => {
  it("cools down a model after a rate limit and makes it eligible again", () => {
    const now = 1_000_000;
    recordModelAttempt("model-a:free", { success: false, status: 429 }, now);

    expect(isModelAvailable("model-a:free", now + 1)).toBe(false);
    expect(isModelAvailable("model-a:free", now + 30_001)).toBe(true);
  });

  it("prefers healthy candidates but never removes the entire fallback chain", () => {
    recordModelAttempt("model-a:free", { success: false, status: 503 });
    const candidates = [{ modelId: "model-a:free" }, { modelId: "model-b:free" }];
    expect(preferAvailableModels(candidates)).toEqual([candidates[1]]);

    recordModelAttempt("model-b:free", { success: false, status: 503 });
    expect(preferAvailableModels(candidates)).toEqual(candidates);
  });

  it("clears a model cooldown after a successful request", () => {
    recordModelAttempt("model-a:free", { success: false, status: 429 });
    recordModelAttempt("model-a:free", { success: true });

    expect(isModelAvailable("model-a:free")).toBe(true);
  });
});
