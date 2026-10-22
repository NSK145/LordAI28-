import { describe, expect, it } from "vitest";
import { hmacSha256Hex, safeEqual } from "./razorpay.server";

describe("Razorpay signature verification helpers", () => {
  it("computes HMAC SHA-256 and compares signatures safely", async () => {
    const signature = await hmacSha256Hex("secret", "payment|subscription");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(safeEqual(signature, signature)).toBe(true);
    expect(safeEqual(signature, `${signature.slice(0, -1)}0`)).toBe(false);
    expect(safeEqual(signature, "short")).toBe(false);
  });
});
