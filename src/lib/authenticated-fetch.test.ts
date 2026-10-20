import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { authenticatedFetch } from "./authenticated-fetch";

const session = (token: string, expiresAt = Math.floor(Date.now() / 1000) + 3600) => ({
  access_token: token,
  expires_at: expiresAt,
});

describe("authenticatedFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    auth.getSession.mockReset();
    auth.refreshSession.mockReset();
  });

  it("sends the current Supabase bearer token", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("valid-token") }, error: null });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    await authenticatedFetch("/api/games", { method: "POST", body: "{}" });

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe(
      "Bearer valid-token",
    );
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("refreshes an expired session before sending the request", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("expired", 1) }, error: null });
    auth.refreshSession.mockResolvedValue({ data: { session: session("refreshed") }, error: null });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    await authenticatedFetch("/api/games", { method: "POST", body: "{}" });

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe(
      "Bearer refreshed",
    );
  });

  it("refreshes and replays one unauthorized request exactly once", async () => {
    auth.getSession.mockResolvedValue({ data: { session: session("old") }, error: null });
    auth.refreshSession.mockResolvedValue({ data: { session: session("new") }, error: null });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await authenticatedFetch("/api/games", { method: "POST", body: "{}" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("authorization")).toBe(
      "Bearer new",
    );
  });

  it("does not retry when there is no signed-in session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));

    const response = await authenticatedFetch("/api/games", { method: "POST", body: "{}" });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has("authorization")).toBe(false);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
});
