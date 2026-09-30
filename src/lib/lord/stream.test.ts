import { describe, expect, it } from "vitest";
import { createAgentProgressResponse } from "./stream";

describe("agent progress stream", () => {
  it("streams progress events before the final result", async () => {
    const response = createAgentProgressResponse(async (onProgress) => {
      await onProgress({
        phase: "planning",
        message: "Planning task.",
        completedTasks: 0,
        totalTasks: 0,
      });
      await onProgress({
        phase: "executing",
        message: "Browse project.",
        completedTasks: 0,
        totalTasks: 1,
        stepId: "step-1",
      });
      return { status: "completed", intent: "Browse", steps: [], summary: "Done." };
    });

    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body.indexOf('"phase":"planning"')).toBeLessThan(body.indexOf('"phase":"executing"'));
    expect(body.indexOf('"type":"result"')).toBeGreaterThan(body.indexOf('"phase":"executing"'));
  });

  it("converts thrown execution failures into a final error event", async () => {
    const response = createAgentProgressResponse(async () => {
      throw new Error("internal detail");
    });

    await expect(response.text()).resolves.toContain(
      '{"type":"error","message":"Agent execution failed."}',
    );
  });

  it("aborts agent execution when the progress stream is cancelled", async () => {
    let executionSignal: AbortSignal | undefined;
    let executionStopped = false;
    const response = createAgentProgressResponse(async (onProgress, signal) => {
      executionSignal = signal;
      await onProgress({
        phase: "executing",
        message: "Working.",
        completedTasks: 0,
        totalTasks: 1,
      });
      await new Promise<void>((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            executionStopped = true;
            resolve();
          },
          { once: true },
        );
      });
      return { status: "completed", intent: "Work", steps: [] };
    });
    const reader = response.body!.getReader();

    await reader.read();
    await reader.cancel();

    expect(executionSignal?.aborted).toBe(true);
    expect(executionStopped).toBe(true);
  });
});
