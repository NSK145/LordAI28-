import { describe, expect, it } from "vitest";
import { TaskQueue } from "./task-queue";

describe("TaskQueue", () => {
  it("runs hundreds of dependency-ordered tasks and reports progress", () => {
    const tasks = Array.from({ length: 500 }, (_, index) => ({
      id: `task-${index}`,
      dependsOn: index === 0 ? [] : [`task-${index - 1}`],
      payload: index,
    }));
    const queue = new TaskQueue(tasks);

    for (let index = 0; index < tasks.length; index++) {
      const task = queue.takeReady();
      expect(task?.payload).toBe(index);
      expect(queue.complete(task!.id)).toBe(true);
    }

    expect(queue.takeReady()).toBeNull();
    expect(queue.getProgress()).toEqual({ total: 500, completed: 500, failed: 0, remaining: 0 });
  });

  it("retries only within its configured retry budget", () => {
    const queue = new TaskQueue([{ id: "retry", payload: null, maxRetries: 1 }]);
    const firstAttempt = queue.takeReady()!;

    expect(queue.fail(firstAttempt.id, "temporary", true)).toBe(true);
    expect(queue.takeReady()?.attempts).toBe(2);
    expect(queue.fail(firstAttempt.id, "still failing", true)).toBe(false);
    expect(queue.get(firstAttempt.id)?.status).toBe("failed");
  });

  it("blocks dependents after prerequisite failure and supports approval waits", () => {
    const queue = new TaskQueue([
      { id: "approval", payload: "write" },
      { id: "dependent", dependsOn: ["approval"], payload: "review" },
      { id: "independent", payload: "read" },
    ]);
    const waiting = queue.takeReady()!;
    queue.waitForApproval(waiting.id);

    const independent = queue.takeReady()!;
    queue.complete(independent.id);
    expect(queue.takeReady()).toBeNull();
    expect(queue.approve(waiting.id)).toBe(true);
    queue.complete(queue.takeReady()!.id);
    expect(queue.takeReady()?.payload).toBe("review");
  });

  it("rejects unknown dependencies and dependency cycles", () => {
    expect(() => new TaskQueue([{ id: "a", dependsOn: ["missing"], payload: null }])).toThrow(
      "unknown task",
    );
    expect(
      () =>
        new TaskQueue([
          { id: "a", dependsOn: ["b"], payload: null },
          { id: "b", dependsOn: ["a"], payload: null },
        ]),
    ).toThrow("cycle");
  });
});
