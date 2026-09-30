import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenRouterClient } from "./client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenRouterClient", () => {
  it("supports configured output limits without logging prompt or response content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          'data: {"choices":[{"delta":{"content":"private response text"}}]}\n\ndata: [DONE]\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenRouterClient("private-api-key");
    const tokens: string[] = [];

    for await (const token of client.streamChat(
      [{ role: "user", content: "private prompt text" }],
      "free-model-id",
      undefined,
      700,
    )) {
      tokens.push(token);
    }

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      max_tokens: number;
      messages: Array<{ content: string }>;
    };
    const logs = JSON.stringify([...info.mock.calls, ...log.mock.calls]);

    expect(request.max_tokens).toBe(700);
    expect(request.messages[0].content).toBe("private prompt text");
    expect(tokens.join("")).toBe("private response text");
    expect(logs).not.toContain("private prompt text");
    expect(logs).not.toContain("private response text");
    expect(logs).not.toContain("private-api-key");
  });
});
