import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenRouterClient } from "./client";

const sse = (payload: string) =>
  new Response(payload, {
    headers: { "Content-Type": "text/event-stream" },
  });

describe("OpenRouter streaming response validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the configured model for non-streaming claim analysis", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '[{"kind":"fact"}]' } }] })),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenRouterClient("test-key").completeChat(
      [{ role: "user", content: "Check this excerpt." }],
      "vendor/model",
    );

    expect(result).toBe('[{"kind":"fact"}]');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "vendor/model",
      stream: false,
      max_tokens: 1400,
    });
  });

  it("does not treat failed claim analysis as a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    await expect(
      new OpenRouterClient("test-key").completeChat(
        [{ role: "user", content: "Check this excerpt." }],
        "vendor/model",
      ),
    ).rejects.toMatchObject({ kind: "rate_limit" });
  });

  it("returns streamed text when the provider sends a completion marker", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sse('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n'),
        ),
    );
    const output: string[] = [];
    for await (const chunk of new OpenRouterClient("test").streamChat(
      [{ role: "user", content: "hello" }],
      "vendor/model",
    ))
      output.push(chunk);
    expect(output.join("")).toBe("Hi");
  });

  it("rejects interrupted streams without the provider completion marker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sse('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')),
    );
    const collect = async () => {
      for await (const _chunk of new OpenRouterClient("test").streamChat(
        [{ role: "user", content: "hello" }],
        "vendor/model",
      )) {
        /* collect */
      }
    };
    await expect(collect()).rejects.toMatchObject({ kind: "malformed_response" });
  });

  it("rejects malformed SSE JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sse("data: {bad json}\n\ndata: [DONE]\n\n")));
    const collect = async () => {
      for await (const _chunk of new OpenRouterClient("test").streamChat(
        [{ role: "user", content: "hello" }],
        "vendor/model",
      )) {
        /* collect */
      }
    };
    await expect(collect()).rejects.toMatchObject({ kind: "malformed_response" });
  });

  it("extracts text from structured provider deltas", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sse(
            'data: {"choices":[{"delta":{"content":{"text":"Structured"}}}]}\n\ndata: [DONE]\n\n',
          ),
        ),
    );
    const output: string[] = [];
    for await (const chunk of new OpenRouterClient("test").streamChat(
      [{ role: "user", content: "hello" }],
      "vendor/model",
    ))
      output.push(chunk);
    expect(output.join("")).toBe("Structured");
  });
});
