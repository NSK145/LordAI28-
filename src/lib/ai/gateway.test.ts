import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouterError } from "./errors";

const mocks = vi.hoisted(() => ({
  streamChat: vi.fn(),
  getAIConfig: vi.fn(() => ({ openRouterApiKey: "test-key" })),
}));

vi.mock("./config", () => ({
  AIConfigurationError: class AIConfigurationError extends Error {},
  getAIConfig: mocks.getAIConfig,
}));

vi.mock("./client", () => ({
  OpenRouterClient: class MockOpenRouterClient {
    async *streamChatEvents(...args: unknown[]) {
      for await (const delta of mocks.streamChat(...args)) {
        if (delta) yield { type: "text", delta };
      }
    }
  },
}));

import { streamChat } from "./gateway";
import { clearModelAvailabilityForTests } from "./model-availability";

async function* tokens(...values: string[]) {
  yield* values;
}

describe("streamChat", () => {
  beforeEach(() => {
    mocks.streamChat.mockReset();
    mocks.getAIConfig.mockClear();
    clearModelAvailabilityForTests();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to the next free candidate after a rate limit", async () => {
    mocks.streamChat
      .mockImplementationOnce(async function* () {
        yield "";
        throw new OpenRouterError("rate_limit", 429);
      })
      .mockImplementationOnce(() => tokens("Lord is ready."));

    const response = streamChat(
      [{ role: "user", content: "hello" }],
      undefined,
      ["first-model:free", "second-model:free"],
      "00000000-0000-4000-8000-000000000001",
    );
    const body = await response.text();

    expect(mocks.streamChat.mock.calls.map((call) => call[1])).toEqual([
      "first-model:free",
      "second-model:free",
    ]);
    expect(body).toContain("Lord is ready.");
  });

  it("treats an empty model stream as unavailable and retries", async () => {
    mocks.streamChat
      .mockImplementationOnce(() => tokens())
      .mockImplementationOnce(() => tokens("Recovered response."));

    const response = streamChat(
      [{ role: "user", content: "hello" }],
      undefined,
      ["empty-model:free", "working-model:free"],
      "00000000-0000-4000-8000-000000000002",
    );

    expect(await response.text()).toContain("Recovered response.");
    expect(mocks.streamChat).toHaveBeenCalledTimes(2);
  });

  it("appends the exact searched sources after the generated answer", async () => {
    mocks.streamChat.mockImplementationOnce(() => tokens("The current fact is supported [S1]."));
    const response = streamChat(
      [{ role: "user", content: "hello" }],
      undefined,
      ["free-model:free"],
      "00000000-0000-4000-8000-000000000004",
      [{ title: "Reference", url: "https://example.com/source", content: "Evidence" }],
    );
    const body = await response.text();
    expect(body).toContain("The current fact is supported [S1].");
    expect(body).toContain("[Reference](https://example.com/source)");
  });

  it("returns a structured, correlated error after all candidates fail", async () => {
    mocks.streamChat.mockImplementation(async function* () {
      yield "";
      throw new OpenRouterError("rate_limit", 429);
    });

    const response = streamChat(
      [{ role: "user", content: "hello" }],
      undefined,
      ["limited-model:free"],
      "00000000-0000-4000-8000-000000000003",
    );
    const body = await response.text();

    expect(body).toContain("00000000-0000-4000-8000-000000000003");
    expect(body).toContain("AI_RATE_LIMITED");
    expect(body).not.toContain("hello");
  });
});
