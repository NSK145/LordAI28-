import { z } from "zod";

const GeneratedPlanSchema = z.object({
  tasks: z
    .array(
      z.object({
        conceptId: z.string().min(1),
        taskType: z.enum(["learn", "practice", "review", "quiz", "flashcards"]),
        dayOffset: z.number().int().min(0).max(365),
        estimatedMinutes: z.number().int().min(5).max(480),
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().min(1).max(500),
        priority: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(1)
    .max(50),
});

export interface StudyPlanGenerationRules {
  allowedConceptIds: string[];
  startDate: Date;
  daysAvailable: number;
  dailyMinutes: number;
  preferredDays: number[];
}

export interface GeneratedStudyPlanTask {
  concept_id: string;
  title: string;
  description: string;
  task_type: "learn" | "practice" | "review" | "quiz" | "flashcards";
  due_at: string;
  estimated_minutes: number;
  priority: "high" | "medium" | "low";
  status: "pending";
  position: number;
  notes: null;
}

export type StudyPlanGenerationResult =
  | { ok: true; tasks: GeneratedStudyPlanTask[] }
  | { ok: false; reason: "invalid_json" | "invalid_schedule"; message: string };

export function normalizeGeneratedStudyPlan(
  output: string,
  rules: StudyPlanGenerationRules,
): StudyPlanGenerationResult {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  let generated: z.infer<typeof GeneratedPlanSchema>;
  try {
    generated = GeneratedPlanSchema.parse(jsonMatch ? JSON.parse(jsonMatch[0]) : null);
  } catch {
    return {
      ok: false,
      reason: "invalid_json",
      message: "LORD returned an invalid study plan. Please retry.",
    };
  }

  const allowedConceptIds = new Set(rules.allowedConceptIds);
  const coveredConceptIds = new Set<string>();
  const minutesByDay = new Map<number, number>();
  const normalized: GeneratedStudyPlanTask[] = [];

  for (const [position, task] of generated.tasks.entries()) {
    const taskDate = new Date(rules.startDate.getTime() + task.dayOffset * 86400000);
    if (
      !allowedConceptIds.has(task.conceptId) ||
      task.dayOffset >= rules.daysAvailable ||
      task.estimatedMinutes > rules.dailyMinutes ||
      !rules.preferredDays.includes(taskDate.getUTCDay())
    ) {
      return {
        ok: false,
        reason: "invalid_schedule",
        message: "LORD returned tasks outside your selected concepts or schedule. Please retry.",
      };
    }

    coveredConceptIds.add(task.conceptId);
    const dayTotal = (minutesByDay.get(task.dayOffset) ?? 0) + task.estimatedMinutes;
    if (dayTotal > rules.dailyMinutes) {
      return {
        ok: false,
        reason: "invalid_schedule",
        message: "LORD returned a schedule that exceeds your daily study-time limit. Please retry.",
      };
    }
    minutesByDay.set(task.dayOffset, dayTotal);
    normalized.push({
      concept_id: task.conceptId,
      title: task.title,
      description: task.description,
      task_type: task.taskType,
      due_at: taskDate.toISOString(),
      estimated_minutes: task.estimatedMinutes,
      priority: task.priority,
      status: "pending",
      position,
      notes: null,
    });
  }

  if (rules.allowedConceptIds.some((conceptId) => !coveredConceptIds.has(conceptId))) {
    return {
      ok: false,
      reason: "invalid_schedule",
      message: "LORD did not include every selected concept. Please retry.",
    };
  }

  return { ok: true, tasks: normalized };
}
