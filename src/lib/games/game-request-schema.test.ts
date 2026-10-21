import { describe, expect, it } from "vitest";
import { GameRequestSchema } from "./game-request-schema";

describe("game creation request validation", () => {
  it("accepts a valid generation request and applies the normal difficulty default", () => {
    expect(GameRequestSchema.parse({ action: "generate", prompt: "A neon runner" })).toEqual({
      action: "generate",
      prompt: "A neon runner",
      difficulty: "normal",
      dimension: "2d",
    });
  });

  it("rejects malformed and too-short generation payloads", () => {
    expect(GameRequestSchema.safeParse({ action: "generate", prompt: 42 }).success).toBe(false);
    expect(GameRequestSchema.safeParse({ action: "generate", prompt: "tiny" }).success).toBe(false);
    expect(GameRequestSchema.safeParse(null).success).toBe(false);
  });
});
