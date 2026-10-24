import { describe, expect, it } from "vitest";
import { isUnsafeAssistantError, safeChatErrorMessage } from "./safe-chat-error";

describe("safe chat error rendering", () => {
  it("replaces HTML fallback pages with a clean retryable message", () => {
    const html = "<!doctype html><html><body>page didn't load</body></html>";
    expect(isUnsafeAssistantError(html)).toBe(true);
    expect(safeChatErrorMessage(html)).toContain("try again");
    expect(safeChatErrorMessage(html)).not.toContain("<html>");
  });

  it("does not expose server stack traces", () => {
    expect(safeChatErrorMessage("Internal Server Error at handler (server.js:12)")).not.toContain(
      "server.js",
    );
  });

  it("keeps ordinary provider messages readable", () => {
    expect(safeChatErrorMessage("OpenRouter rate limit reached.")).toBe(
      "OpenRouter rate limit reached.",
    );
  });
});
