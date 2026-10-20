import { describe, expect, it } from "vitest";
import { generationFailure } from "./game-errors";

describe("AI generation error classification", () => {
  it("classifies missing credentials without exposing configuration details", () => {
    expect(generationFailure(new Error("OPENROUTER_API_KEY missing"))).toMatchObject({
      kind: "not_configured",
      message: "Game generation is not configured on the server.",
    });
  });

  it("classifies provider rate limits, unavailable models, and timeouts", () => {
    expect(generationFailure({ statusCode: 429 })).toMatchObject({ kind: "rate_limited" });
    expect(generationFailure({ statusCode: 404 })).toMatchObject({ kind: "model_unavailable" });
    expect(generationFailure(new Error("Request timed out"))).toMatchObject({ kind: "timeout" });
  });

  it("classifies other provider failures without returning upstream details", () => {
    const failure = generationFailure(new Error("secret provider response"));
    expect(failure.kind).toBe("generation");
    expect(failure.message).not.toContain("secret");
  });
});
