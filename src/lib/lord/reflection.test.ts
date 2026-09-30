import { beforeEach, describe, expect, it, vi } from "vitest";

const reasoner = vi.hoisted(() => ({ runLordJson: vi.fn() }));

vi.mock("./llm", () => ({ runLordJson: reasoner.runLordJson }));

import { reflectToolResult } from "./reflection";

describe("execution reflection", () => {
  beforeEach(() => reasoner.runLordJson.mockReset());

  it("accepts a reviewed successful result", async () => {
    reasoner.runLordJson.mockResolvedValue({
      decision: "continue",
      reason: "File listing is valid.",
    });

    await expect(
      reflectToolResult({
        intent: "List project files",
        tool: "files.browse",
        risk: "low",
        attempt: 1,
        result: { success: true, message: "Found 4 files." },
      }),
    ).resolves.toEqual({ decision: "continue", reason: "File listing is valid." });
    expect(reasoner.runLordJson).toHaveBeenCalled();
  });

  it("allows retries only for recoverable low-risk failures", async () => {
    reasoner.runLordJson.mockResolvedValue({ decision: "retry", reason: "Try the read again." });

    const lowRisk = await reflectToolResult({
      intent: "Browse files",
      tool: "files.browse",
      risk: "low",
      attempt: 1,
      result: { success: false, message: "Temporary I/O error", recoverable: true },
    });
    const highRisk = await reflectToolResult({
      intent: "Delete file",
      tool: "files.delete",
      risk: "high",
      attempt: 1,
      result: { success: false, message: "Temporary I/O error", recoverable: true },
    });

    expect(lowRisk.decision).toBe("retry");
    expect(highRisk.decision).toBe("continue");
  });

  it("uses deterministic recovery when the reflection response is malformed", async () => {
    reasoner.runLordJson.mockResolvedValue(undefined);

    await expect(
      reflectToolResult({
        intent: "Search files",
        tool: "files.search",
        risk: "low",
        attempt: 1,
        result: { success: false, message: "Try again", recoverable: true },
      }),
    ).resolves.toMatchObject({ decision: "retry" });
  });
});
