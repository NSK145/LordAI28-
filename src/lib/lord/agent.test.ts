import { beforeEach, describe, expect, it, vi } from "vitest";

const agentMocks = vi.hoisted(() => ({
  buildToolCatalog: vi.fn(),
  getTool: vi.fn(),
  evaluatePermission: vi.fn(),
  makeToolContext: vi.fn(),
  disposeToolContext: vi.fn(),
  executeTool: vi.fn(),
  runLordJson: vi.fn(),
  runLordText: vi.fn(),
  reflectToolResult: vi.fn(),
  getRepositoryPromptContext: vi.fn(),
  resolveRepositoryRoot: vi.fn(() => "/repo"),
  getState: vi.fn(),
  pushActivity: vi.fn(),
  executions: new Map<string, AbortController>(),
  tools: new Map<string, unknown>(),
}));

vi.mock("./registry", () => ({
  buildToolCatalog: agentMocks.buildToolCatalog,
  getTool: agentMocks.getTool,
}));
vi.mock("./permissions", () => ({ evaluatePermission: agentMocks.evaluatePermission }));
vi.mock("./exec", () => ({
  makeToolContext: agentMocks.makeToolContext,
  disposeToolContext: agentMocks.disposeToolContext,
  executeTool: agentMocks.executeTool,
}));
vi.mock("./llm", () => ({
  runLordJson: agentMocks.runLordJson,
  runLordText: agentMocks.runLordText,
}));
vi.mock("./reflection", () => ({ reflectToolResult: agentMocks.reflectToolResult }));
vi.mock("./tools/repository", () => ({
  getRepositoryPromptContext: agentMocks.getRepositoryPromptContext,
  resolveRepositoryRoot: agentMocks.resolveRepositoryRoot,
}));
vi.mock("./state", () => ({
  detachExecutionAbortListener: vi.fn(),
  getState: agentMocks.getState,
  pushActivity: agentMocks.pushActivity,
}));

import { confirmAgentPlan, planAgentCommand } from "./agent";

describe("agent execution loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentMocks.executions.clear();
    agentMocks.tools.clear();
    for (const [name, risk] of [
      ["files.browse", "low"],
      ["files.preview", "low"],
      ["files.write_text", "high"],
      ["code.validate", "high"],
    ] as const) {
      agentMocks.tools.set(name, {
        name,
        category: "files",
        risk,
        requiresConfirmation: risk === "high",
      });
    }
    agentMocks.buildToolCatalog.mockReturnValue([...agentMocks.tools.values()]);
    agentMocks.getTool.mockImplementation((name: string) => agentMocks.tools.get(name));
    agentMocks.evaluatePermission.mockImplementation(({ risk }: { risk: string }) =>
      risk === "high"
        ? { decision: "confirm", reason: "Approval required." }
        : { decision: "allow", reason: "Allowed." },
    );
    agentMocks.getState.mockImplementation(() => ({ executions: agentMocks.executions }));
    agentMocks.makeToolContext.mockImplementation(
      (executionId: string, _userId?: string, signal?: AbortSignal) => {
        const controller = new AbortController();
        agentMocks.executions.set(executionId, controller);
        return { executionId, signal: signal ?? controller.signal };
      },
    );
    agentMocks.executeTool.mockImplementation(async (tool: string) => ({
      success: true,
      message: `${tool} completed`,
    }));
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Inspect project",
      steps: [
        { tool: "files.browse", params: {}, intent: "Browse files" },
        {
          tool: "files.preview",
          params: { path: "README.md" },
          intent: "Preview readme",
          dependsOn: [0],
        },
      ],
    });
    agentMocks.runLordText.mockResolvedValue({ text: "Project inspected." });
    agentMocks.getRepositoryPromptContext.mockReturnValue(
      "Repository graph: React and TypeScript.",
    );
    agentMocks.reflectToolResult.mockResolvedValue({
      decision: "continue",
      reason: "Result is valid.",
    });
  });

  it("runs dependency-linked steps in order and emits progress", async () => {
    const onProgress = vi.fn();
    const result = await planAgentCommand(
      "Inspect this project",
      "user-1",
      onProgress,
      "The project uses TypeScript.",
    );

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.status)).toEqual(["done", "done"]);
    expect(result.steps[1].dependencies).toEqual([result.steps[0].id]);
    expect(agentMocks.runLordJson.mock.calls[0][0].prompt).toContain("The project uses TypeScript");
    expect(agentMocks.runLordJson.mock.calls[0][0].prompt).toContain(
      "Repository graph: React and TypeScript",
    );
    expect(agentMocks.executeTool.mock.calls.map(([tool]) => tool)).toEqual([
      "files.browse",
      "files.preview",
    ]);
    expect(agentMocks.reflectToolResult).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: "planning" }));
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: "analysis" }));
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "context-retrieval" }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "repository-analysis", percent: 5 }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "reasoning", percent: 10 }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "completed", percent: 100 }),
    );
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ phase: "reflecting" }));
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "executing", activeTask: "Browse files", etaMs: 600_000 }),
    );
  });

  it("returns planner analysis, task estimates, and a factual engineering report", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Secure authentication",
      analysis: {
        objective: "Secure authentication",
        taskType: "security",
        complexity: "medium",
        affectedSystems: ["auth"],
        estimatedScope: 2,
        risk: "low",
        requiredPermissions: [],
      },
      steps: [
        {
          tool: "files.preview",
          params: { path: "src/auth.ts" },
          intent: "Inspect authentication implementation",
          title: "Inspect auth",
          description: "Read current auth implementation.",
          estimatedComplexity: "medium",
          estimatedDurationMinutes: 8,
          affectedFiles: ["src/auth.ts"],
          expectedOutputs: ["Auth implementation reviewed"],
        },
      ],
    });

    const result = await planAgentCommand("Secure authentication", "user-1");

    expect(result.analysis).toMatchObject({ taskType: "security", estimatedScope: 2 });
    expect(result.steps[0]).toMatchObject({
      title: "Inspect auth",
      estimatedComplexity: "medium",
      estimatedDurationMinutes: 8,
      affectedFiles: ["src/auth.ts"],
      expectedOutputs: ["Auth implementation reviewed"],
      approvalRequired: false,
      retryPolicy: { maxRetries: 2, recoverableOnly: true },
    });
    expect(result.report).toMatchObject({
      objective: "Secure authentication",
      completedTasks: ["Inspect authentication implementation"],
      filesModified: [],
      validations: [],
      remainingIssues: [],
      manualFollowUp: ["No test, lint, build, or type-check task was included in the plan."],
      confidence: 0.8,
    });
    expect(result.report?.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("forwards request cancellation into free-model planning", async () => {
    const controller = new AbortController();

    await planAgentCommand("Inspect this project", "user-1", undefined, "", controller.signal);

    expect(agentMocks.runLordJson).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("rejects plans containing an unknown tool instead of silently dropping that task", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Inspect and edit project",
      steps: [
        { tool: "files.browse", params: {}, intent: "Browse files" },
        { tool: "missing.execute", params: {}, intent: "Run an unavailable action" },
      ],
    });

    const result = await planAgentCommand("Inspect and edit project", "user-1");

    expect(result.status).toBe("error");
    expect(agentMocks.executeTool).not.toHaveBeenCalled();
  });

  it("rejects duplicate tool actions before execution", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Browse project",
      steps: [
        { tool: "files.browse", params: { path: "src" }, intent: "Browse source" },
        { tool: "files.browse", params: { path: "src" }, intent: "Browse source again" },
      ],
    });

    const result = await planAgentCommand("Browse project", "user-1");

    expect(result.status).toBe("error");
    expect(agentMocks.executeTool).not.toHaveBeenCalled();
  });

  it("pauses high-risk work for approval and resumes the queue", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Write a file",
      steps: [{ tool: "files.write_text", params: { path: "output.txt" }, intent: "Write output" }],
    });

    const planned = await planAgentCommand("Write output", "user-1");
    expect(planned.status).toBe("needs-confirmation");
    expect(planned.steps[0].status).toBe("waiting");
    expect(agentMocks.executeTool).not.toHaveBeenCalled();
    expect(planned.analysis).toBeDefined();

    agentMocks.executeTool.mockResolvedValueOnce({
      success: true,
      message: "Wrote output.txt.",
      data: { path: "/repo/output.txt" },
    });
    const completed = await confirmAgentPlan(planned.planId!, "all", "user-1");
    expect(completed.status).toBe("completed");
    expect(completed.steps[0].status).toBe("done");
    expect(completed.report?.filesModified).toEqual(["/repo/output.txt"]);
    expect(completed.analysis).toEqual(planned.analysis);
    expect(agentMocks.executeTool).toHaveBeenCalledWith(
      "files.write_text",
      { path: "output.txt" },
      expect.anything(),
      { userId: "user-1", forceAllow: true },
    );
  });

  it("requires approval before validation and reports the observed result", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Validate changes",
      steps: [{ tool: "code.validate", params: { script: "test" }, intent: "Run tests" }],
    });

    const planned = await planAgentCommand("Validate changes", "user-1");

    expect(planned.status).toBe("needs-confirmation");
    expect(agentMocks.executeTool).not.toHaveBeenCalled();
    const onProgress = vi.fn();
    const completed = await confirmAgentPlan(planned.planId!, "all", "user-1", onProgress);

    expect(completed.report?.validations).toEqual([
      { tool: "code.validate", status: "passed", evidence: "code.validate completed" },
    ]);
    expect(completed.report?.manualFollowUp).toEqual([]);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "validation", activeTask: "Run tests" }),
    );
  });

  it("retries recoverable low-risk work once after reflection", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Browse",
      steps: [{ tool: "files.browse", params: {}, intent: "Browse files" }],
    });
    agentMocks.executeTool
      .mockResolvedValueOnce({ success: false, message: "Temporary failure", recoverable: true })
      .mockResolvedValueOnce({ success: true, message: "Browse succeeded" });
    agentMocks.reflectToolResult
      .mockResolvedValueOnce({ decision: "retry", reason: "Safe retry" })
      .mockResolvedValueOnce({ decision: "continue", reason: "Recovered" });

    const result = await planAgentCommand("Browse files", "user-1");

    expect(result.steps[0].status).toBe("done");
    expect(result.steps[0].attempts).toBe(2);
    expect(agentMocks.executeTool).toHaveBeenCalledTimes(2);
  });

  it("caps recoverable low-risk reflection retries at two", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Browse",
      steps: [{ tool: "files.browse", params: {}, intent: "Browse files" }],
    });
    agentMocks.executeTool.mockResolvedValue({
      success: false,
      message: "Temporary failure",
      recoverable: true,
    });
    agentMocks.reflectToolResult.mockResolvedValue({ decision: "retry", reason: "Safe retry" });

    const result = await planAgentCommand("Browse files", "user-1");

    expect(agentMocks.executeTool).toHaveBeenCalledTimes(3);
    expect(result.steps[0].attempts).toBe(3);
    expect(result.report?.remainingIssues).toHaveLength(1);
  });

  it("rejects invalid dependency indexes before any tool can run", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Browse project",
      steps: [{ tool: "files.browse", params: {}, intent: "Browse files", dependsOn: [1] }],
    });

    const result = await planAgentCommand("Browse project", "user-1");

    expect(result.status).toBe("error");
    expect(agentMocks.executeTool).not.toHaveBeenCalled();
  });

  it("does not allow another user to approve a pending plan", async () => {
    agentMocks.runLordJson.mockResolvedValue({
      intent: "Write a file",
      steps: [{ tool: "files.write_text", params: {}, intent: "Write output" }],
    });
    const planned = await planAgentCommand("Write output", "user-1");

    const rejected = await confirmAgentPlan(planned.planId!, "all", "user-2");

    expect(rejected.status).toBe("error");
    expect(agentMocks.executeTool).not.toHaveBeenCalled();
  });
});
