import { describe, expect, it } from "vitest";
import { decideConnectivity } from "./connectivity";

describe("decideConnectivity", () => {
  it("keeps the banner hidden while the browser reports online", () => {
    expect(
      decideConnectivity({
        navigatorOnline: true,
        backendReachable: false,
        consecutiveFailures: 4,
      }),
    ).toBe("online");
  });

  it("does not show offline for an API timeout by itself", () => {
    expect(
      decideConnectivity({
        navigatorOnline: true,
        backendReachable: false,
        consecutiveFailures: 2,
      }),
    ).toBe("online");
  });

  it("confirms offline after repeated browser and backend failures", () => {
    expect(
      decideConnectivity({
        navigatorOnline: false,
        backendReachable: false,
        consecutiveFailures: 1,
      }),
    ).toBe("unknown");
    expect(
      decideConnectivity({
        navigatorOnline: false,
        backendReachable: false,
        consecutiveFailures: 2,
      }),
    ).toBe("offline");
  });

  it("clears offline immediately when the browser or backend reconnects", () => {
    expect(
      decideConnectivity({
        navigatorOnline: true,
        backendReachable: false,
        consecutiveFailures: 2,
      }),
    ).toBe("online");
    expect(
      decideConnectivity({
        navigatorOnline: false,
        backendReachable: true,
        consecutiveFailures: 2,
      }),
    ).toBe("online");
  });
});
