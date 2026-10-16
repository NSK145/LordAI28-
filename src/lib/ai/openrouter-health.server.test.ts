import { describe, expect, it, vi } from "vitest";
import { checkOpenRouterHealth } from "./openrouter-health.server";

describe("checkOpenRouterHealth", () => {
  it("reports missing credentials without contacting the provider", async () => {
    const fetcher = vi.fn();
    const result = await checkOpenRouterHealth(undefined, fetcher);

    expect(result.status).toBe("missing_credentials");
    expect(result.modelIds).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns provider model ids without including credentials in the result", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: [{ id: "vendor/model-a" }, { name: "no-id" }, null] }),
      );
    const result = await checkOpenRouterHealth("secret-test-key", fetcher);

    expect(result).toMatchObject({ ok: true, status: "available", modelIds: ["vendor/model-a"] });
    expect(JSON.stringify(result)).not.toContain("secret-test-key");
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret-test-key" },
        cache: "no-store",
      }),
    );
  });

  it.each([
    [401, "invalid_credentials"],
    [429, "rate_limited"],
    [503, "unavailable"],
  ] as const)("maps provider HTTP %i to a safe %s status", async (status, expected) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    await expect(checkOpenRouterHealth("secret-test-key", fetcher)).resolves.toMatchObject({
      ok: false,
      status: expected,
      modelIds: [],
    });
  });

  it("reports provider timeouts without leaking the underlying error", async () => {
    const timeout = new Error("Timed out while using secret-test-key");
    timeout.name = "TimeoutError";
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    const result = await checkOpenRouterHealth("secret-test-key", fetcher);

    expect(result).toMatchObject({ ok: false, status: "timeout", modelIds: [] });
    expect(JSON.stringify(result)).not.toContain("secret-test-key");
  });
});
