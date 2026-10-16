import { describe, expect, it } from "vitest";
import { buildStudyPlanUpdate, isValidPlanCalendarDate } from "./plan-updates";

describe("buildStudyPlanUpdate", () => {
  it("maps form fields to database columns without leaking API aliases", () => {
    const update = buildStudyPlanUpdate({
      title: "Exam preparation",
      description: "Review core topics",
      startDate: "2026-10-01",
      targetDate: "2026-11-01",
      dailyMinutes: 60,
      status: "active",
      source: "manual",
    });

    expect(update).toEqual({
      title: "Exam preparation",
      description: "Review core topics",
      starts_on: "2026-10-01",
      ends_on: "2026-11-01",
      daily_minutes: 60,
      status: "active",
      source: "manual",
    });
    expect(update).not.toHaveProperty("startDate");
    expect(update).not.toHaveProperty("targetDate");
    expect(update).not.toHaveProperty("dailyMinutes");
  });

  it("merges plan preferences into generated_from metadata", () => {
    expect(
      buildStudyPlanUpdate(
        {
          subjects: ["Math"],
          preferredDays: [1, 3, 5],
          difficulty: "hard",
          examDate: "2026-11-01",
        },
        { conceptIds: ["c1"], custom: "keep" },
      ),
    ).toEqual({
      generated_from: {
        conceptIds: ["c1"],
        custom: "keep",
        subjects: ["Math"],
        preferred_days: [1, 3, 5],
        difficulty: "hard",
        exam_date: "2026-11-01",
      },
    });
  });

  it("accepts real calendar dates and rejects normalized invalid dates", () => {
    expect(isValidPlanCalendarDate("2026-02-28")).toBe(true);
    expect(isValidPlanCalendarDate("2026-02-31")).toBe(false);
    expect(isValidPlanCalendarDate("not-a-date")).toBe(false);
  });
});
