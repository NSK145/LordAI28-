import { describe, expect, it } from "vitest";
import {
  MissionPlanError,
  missionProgress,
  nextReadyStep,
  planMission,
  updateBlockedSteps,
  validateMissionPlan,
  type MissionPlan,
} from "./mission-engine";

function makePlan(): MissionPlan {
  return {
    title: "Explain and review",
    summary: "Answer a question and review supplied code.",
    questions: [],
    steps: [
      {
        id: "answer",
        action: "study.explain",
        arguments: { question: "What is a closure?", subject: "JavaScript" },
        description: "Explain closures",
        expectedResult: "A clear explanation",
        dependencies: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 1, recoverableOnly: true },
        requiresApproval: false,
        status: "pending",
        attempts: 0,
      },
      {
        id: "review",
        action: "coding.review",
        arguments: { code: "const value = 1;", language: "javascript" },
        description: "Review the supplied code",
        expectedResult: "A code review",
        dependencies: ["answer"],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 1, recoverableOnly: true },
        requiresApproval: false,
        status: "pending",
        attempts: 0,
      },
    ],
  };
}

describe("mission plan validation", () => {
  it("validates enabled tools, arguments, dependencies, and acyclic ordering", () => {
    const plan = makePlan();
    expect(() => validateMissionPlan(plan, ["study.explain", "coding.review"])).not.toThrow();
    expect(nextReadyStep(plan.steps)?.id).toBe("answer");

    plan.steps[0]!.status = "completed";
    expect(nextReadyStep(plan.steps)?.id).toBe("review");
    expect(missionProgress(plan.steps)).toBe(50);
  });

  it("rejects unsupported tools, malformed arguments, and dependency cycles", () => {
    const unsupported = makePlan();
    expect(() => validateMissionPlan(unsupported, ["study.explain"])).toThrow(MissionPlanError);

    const invalidArgs = makePlan();
    invalidArgs.steps[0]!.arguments = { question: "" };
    expect(() => validateMissionPlan(invalidArgs, ["study.explain", "coding.review"])).toThrow(
      MissionPlanError,
    );

    const cyclic = makePlan();
    cyclic.steps[0]!.dependencies = ["review"];
    expect(() => validateMissionPlan(cyclic, ["study.explain", "coding.review"])).toThrow(
      /dependency cycle/,
    );
  });

  it("rejects excessive workloads and approval-policy changes", () => {
    const tooLong = makePlan();
    tooLong.steps.push(
      { ...tooLong.steps[0]!, id: "extra-1" },
      { ...tooLong.steps[0]!, id: "extra-2" },
      { ...tooLong.steps[0]!, id: "extra-3" },
    );
    tooLong.steps.forEach((step) => {
      step.timeoutMs = 60_000;
    });
    expect(() => validateMissionPlan(tooLong, ["study.explain", "coding.review"])).toThrow(
      /total execution limit/,
    );

    const unapprovedGame = makePlan();
    unapprovedGame.steps[0]!.action = "jalwa.create";
    unapprovedGame.steps[0]!.arguments = { prompt: "A small neon maze" };
    expect(() => validateMissionPlan(unapprovedGame, ["jalwa.create", "coding.review"])).toThrow(
      /approval or retry policy/,
    );
  });

  it("asks for clarification without producing executable steps", async () => {
    const plan = await planMission(
      "Make this better",
      async () => ({
        text: JSON.stringify({
          title: "Clarify the goal",
          summary: "More detail is needed.",
          questions: ["What should be improved?"],
          steps: [],
        }),
        modelId: "configured-model",
      }),
      ["chat.respond"],
    );
    expect(plan.questions).toEqual(["What should be improved?"]);
    expect(plan.steps).toEqual([]);
    expect(() => validateMissionPlan(plan, ["chat.respond"])).not.toThrow();
  });

  it("rejects malformed model plans and overlong goals", async () => {
    await expect(
      planMission("x".repeat(2_001), async () => ({ text: "{}", modelId: "m" }), ["chat.respond"]),
    ).rejects.toThrow(/2,000 characters/);
    await expect(
      planMission("Do work", async () => ({ text: "not JSON", modelId: "m" }), ["chat.respond"]),
    ).rejects.toThrow(/invalid plan data/);
  });

  it("unblocks dependents only after prerequisites complete", () => {
    const plan = makePlan();
    plan.steps[0]!.status = "failed";
    const blocked = updateBlockedSteps(plan.steps);
    expect(blocked[1]?.status).toBe("skipped");
    blocked[0]!.status = "completed";
    expect(updateBlockedSteps(blocked)[1]?.status).toBe("pending");
  });
});
