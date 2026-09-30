export type TaskQueueStatus =
  "pending" | "running" | "waiting" | "completed" | "failed" | "skipped";

export interface TaskQueueTask<T> {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly payload: T;
  status: TaskQueueStatus;
  attempts: number;
  readonly maxRetries: number;
  error?: string;
}

export interface TaskQueueInput<T> {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  readonly payload: T;
  readonly maxRetries?: number;
}

export class TaskQueue<T> {
  private readonly tasks = new Map<string, TaskQueueTask<T>>();
  private readonly dependents = new Map<string, string[]>();
  private readonly unresolvedDependencies = new Map<string, number>();
  private readonly readyIds: string[] = [];
  private readyOffset = 0;

  constructor(inputs: readonly TaskQueueInput<T>[]) {
    for (const input of inputs) {
      if (this.tasks.has(input.id)) throw new Error(`Duplicate task id: ${input.id}`);
      this.tasks.set(input.id, {
        id: input.id,
        dependsOn: [...new Set(input.dependsOn ?? [])],
        payload: input.payload,
        status: "pending",
        attempts: 0,
        maxRetries: Math.max(0, input.maxRetries ?? 0),
      });
      this.dependents.set(input.id, []);
    }

    for (const task of this.tasks.values()) {
      for (const dependencyId of task.dependsOn) {
        if (!this.tasks.has(dependencyId)) {
          throw new Error(`Task ${task.id} depends on unknown task ${dependencyId}.`);
        }
        if (dependencyId === task.id) throw new Error(`Task ${task.id} cannot depend on itself.`);
        this.dependents.get(dependencyId)!.push(task.id);
      }
      this.unresolvedDependencies.set(task.id, task.dependsOn.length);
      if (task.dependsOn.length === 0) this.readyIds.push(task.id);
    }

    this.assertAcyclic();
  }

  takeReady(): TaskQueueTask<T> | null {
    while (this.readyOffset < this.readyIds.length) {
      const task = this.tasks.get(this.readyIds[this.readyOffset++]);
      if (!task || task.status !== "pending") continue;
      task.status = "running";
      task.attempts++;
      return task;
    }
    return null;
  }

  waitForApproval(taskId: string): boolean {
    const task = this.get(taskId);
    if (!task || task.status !== "running") return false;
    task.status = "waiting";
    return true;
  }

  approve(taskId: string): boolean {
    const task = this.get(taskId);
    if (!task || task.status !== "waiting") return false;
    task.status = "pending";
    this.readyIds.push(taskId);
    return true;
  }

  complete(taskId: string): boolean {
    const task = this.get(taskId);
    if (!task || task.status !== "running") return false;
    task.status = "completed";
    for (const dependentId of this.dependents.get(taskId) ?? []) {
      const remaining = (this.unresolvedDependencies.get(dependentId) ?? 1) - 1;
      this.unresolvedDependencies.set(dependentId, remaining);
      if (remaining === 0) this.readyIds.push(dependentId);
    }
    return true;
  }

  fail(taskId: string, error: string, retryable = false): boolean {
    const task = this.get(taskId);
    if (!task || task.status !== "running") return false;
    task.error = error;
    if (retryable && task.attempts <= task.maxRetries) {
      task.status = "pending";
      this.readyIds.push(taskId);
      return true;
    }
    task.status = "failed";
    this.skipDependents(taskId);
    return false;
  }

  skip(taskId: string, reason = "Task skipped."): boolean {
    const task = this.get(taskId);
    if (!task || (task.status !== "pending" && task.status !== "waiting")) return false;
    task.status = "skipped";
    task.error = reason;
    this.skipDependents(taskId);
    return true;
  }

  cancelPending(reason = "Execution aborted."): void {
    for (const task of this.tasks.values()) {
      if (task.status !== "pending" && task.status !== "waiting") continue;
      task.status = "skipped";
      task.error = reason;
    }
  }

  get(taskId: string): TaskQueueTask<T> | undefined {
    return this.tasks.get(taskId);
  }

  snapshot(): readonly TaskQueueTask<T>[] {
    return [...this.tasks.values()];
  }

  getProgress(): { total: number; completed: number; failed: number; remaining: number } {
    let completed = 0;
    let failed = 0;
    let remaining = 0;
    for (const task of this.tasks.values()) {
      if (task.status === "completed") completed++;
      else if (task.status === "failed" || task.status === "skipped") failed++;
      else remaining++;
    }
    return { total: this.tasks.size, completed, failed, remaining };
  }

  private skipDependents(taskId: string): void {
    for (const dependentId of this.dependents.get(taskId) ?? []) {
      const dependent = this.tasks.get(dependentId);
      if (!dependent || dependent.status === "completed" || dependent.status === "failed") continue;
      dependent.status = "skipped";
      dependent.error = `Dependency ${taskId} did not complete.`;
      this.skipDependents(dependentId);
    }
  }

  private assertAcyclic(): void {
    const indegree = new Map(this.unresolvedDependencies);
    const ready = [...this.readyIds];
    let visited = 0;
    for (let index = 0; index < ready.length; index++) {
      const taskId = ready[index];
      visited++;
      for (const dependentId of this.dependents.get(taskId) ?? []) {
        const remaining = (indegree.get(dependentId) ?? 1) - 1;
        indegree.set(dependentId, remaining);
        if (remaining === 0) ready.push(dependentId);
      }
    }
    if (visited !== this.tasks.size) throw new Error("Task dependencies contain a cycle.");
  }
}
