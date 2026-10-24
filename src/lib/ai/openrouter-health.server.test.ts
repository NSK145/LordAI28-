import { describe, expect, it, vi } from "vitest";
import { checkOpenRouterHealth, probeOpenRouterModel } from "./openrouter-health.server";

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

  it("distinguishes provider model errors and validates completion response shape", async () => {
    const cases = [
      [404, "unsupported_model"],
      [402, "insufficient_credits"],
      [401, "invalid_credentials"],
      [429, "rate_limited"],
    ] as const;
    for (const [status, expected] of cases) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
      await expect(
        probeOpenRouterModel("secret-test-key", "vendor/model", fetcher),
      ).resolves.toMatchObject({ status: expected });
    }
    const malformed = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [] }));
    await expect(
      probeOpenRouterModel("secret-test-key", "vendor/model", malformed),
    ).resolves.toMatchObject({ status: "malformed_response" });
    const success = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: [{ type: "text", text: "OK" }] } }] }),
      );
    await expect(
      probeOpenRouterModel("secret-test-key", "vendor/model", success),
    ).resolves.toMatchObject({ status: "available" });
  });

  it("reports malformed provider catalog JSON", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>error</html>", { status: 200 }));
    await expect(checkOpenRouterHealth("secret-test-key", fetcher)).resolves.toMatchObject({
      status: "malformed_response",
    });
  });
});
