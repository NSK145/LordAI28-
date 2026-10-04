import { describe, expect, it } from "vitest";
import { routeFromAppUrl, safeInternalRoute } from "./mobile-native";

describe("safeInternalRoute", () => {
  it("allows app-local paths, query strings, and fragments", () => {
    expect(safeInternalRoute("/chat?conversation=123#latest")).toBe(
      "/chat?conversation=123#latest",
    );
  });

  it("rejects external, protocol-relative, and malformed paths", () => {
    expect(safeInternalRoute("https://evil.example/chat")).toBeNull();
    expect(safeInternalRoute("//evil.example/chat")).toBeNull();
    expect(safeInternalRoute("/\\evil.example")).toBeNull();
    expect(safeInternalRoute(undefined)).toBeNull();
  });
});

describe("routeFromAppUrl", () => {
  it("only accepts LORD app links and extracts the app route", () => {
    expect(routeFromAppUrl("lordai://open/chat?new=1")).toBe("/chat?new=1");
    expect(routeFromAppUrl("lordai://open/study")).toBe("/study");
  });

  it("rejects other schemes and hosts", () => {
    expect(routeFromAppUrl("https://evil.example/chat")).toBeNull();
    expect(routeFromAppUrl("lordai://evil.example/chat")).toBeNull();
  });
});
