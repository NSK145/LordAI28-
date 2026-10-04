import { describe, expect, it } from "vitest";
import { normalizeNativeApiBaseUrl } from "./api-config";

describe("normalizeNativeApiBaseUrl", () => {
  it("normalizes an HTTPS origin and removes credentials from consideration", () => {
    expect(normalizeNativeApiBaseUrl(" https://lord.example/path/ ")).toBe("https://lord.example");
  });

  it("returns empty when no server was configured", () => {
    expect(normalizeNativeApiBaseUrl(undefined)).toBe("");
  });

  it("rejects insecure and malformed server URLs", () => {
    expect(() => normalizeNativeApiBaseUrl("http://lord.example")).toThrow(/HTTPS/);
    expect(() => normalizeNativeApiBaseUrl("not a URL")).toThrow(/absolute HTTPS URL/);
    expect(() => normalizeNativeApiBaseUrl("https://user:pass@lord.example")).toThrow(/HTTPS/);
  });
});
