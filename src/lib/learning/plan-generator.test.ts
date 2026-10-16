import { describe, expect, it } from "vitest";
import { normalizeGeneratedStudyPlan } from "./plan-generator";

const rules = {
  allowedConceptIds: ["concept-a", "concept-b"],
  startDate: new Date("2026-10-19T00:00:00.000Z"), // Monday
  daysAvailable: 7,
  dailyMinutes: 60,
  preferredDays: [1, 3, 5],
};

const task = (conceptId: string, dayOffset: number, estimatedMinutes = 30) => ({
  conceptId,
  taskType: "practice",
  dayOffset,
  estimatedMinutes,
  title: `Practice ${conceptId}`,
  description: "Solve and check one worked problem.",
  priority: "medium",
});

const output = (tasks: unknown[]) => JSON.stringify({ tasks });

describe("normalizeGeneratedStudyPlan", () => {
  it("converts valid AI tasks to persisted task records", () => {
    const result = normalizeGeneratedStudyPlan(
      output([task("concept-a", 0), task("concept-b", 2)]),
      rules,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tasks.map((item) => item.concept_id)).toEqual(["concept-a", "concept-b"]);
    expect(result.tasks.map((item) => item.due_at)).toEqual([
      "2026-10-19T00:00:00.000Z",
      "2026-10-21T00:00:00.000Z",
    ]);
    expect(result.tasks[0]).toMatchObject({ status: "pending", position: 0, notes: null });
  });

  it("rejects malformed model output", () => {
    expect(normalizeGeneratedStudyPlan("not JSON", rules)).toMatchObject({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("rejects tasks for concepts the student did not select", () => {
    expect(
      normalizeGeneratedStudyPlan(output([task("concept-a", 0), task("other", 2)]), rules),
    ).toMatchObject({
      ok: false,
      reason: "invalid_schedule",
    });
  });

  it("rejects tasks outside the date range or preferred weekdays", () => {
    expect(
      normalizeGeneratedStudyPlan(output([task("concept-a", 1), task("concept-b", 2)]), rules),
    ).toMatchObject({
      ok: false,
      reason: "invalid_schedule",
    });
    expect(
      normalizeGeneratedStudyPlan(output([task("concept-a", 8), task("concept-b", 2)]), rules),
    ).toMatchObject({
      ok: false,
      reason: "invalid_schedule",
    });
  });

  it("rejects schedules that exceed the daily time budget or omit a concept", () => {
    expect(
      normalizeGeneratedStudyPlan(
        output([task("concept-a", 0, 40), task("concept-b", 0, 30)]),
        rules,
      ),
    ).toMatchObject({ ok: false, reason: "invalid_schedule" });
    expect(normalizeGeneratedStudyPlan(output([task("concept-a", 0)]), rules)).toMatchObject({
      ok: false,
      reason: "invalid_schedule",
    });
  });
});
