import type { PlanInput } from "./types";

export type StudyPlanUpdateInput = Omit<Partial<PlanInput>, "description" | "examDate"> & {
  description?: string | null;
  examDate?: string | null;
};

export function buildStudyPlanUpdate(
  patch: StudyPlanUpdateInput,
  currentMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.startDate !== undefined) update.starts_on = patch.startDate;
  if (patch.targetDate !== undefined) update.ends_on = patch.targetDate;
  if (patch.dailyMinutes !== undefined) update.daily_minutes = patch.dailyMinutes;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.source !== undefined) update.source = patch.source;

  const metadata: Record<string, unknown> = { ...currentMetadata };
  if (patch.subjects !== undefined) metadata.subjects = patch.subjects;
  if (patch.preferredDays !== undefined) metadata.preferred_days = patch.preferredDays;
  if (patch.difficulty !== undefined) metadata.difficulty = patch.difficulty;
  if (patch.examDate !== undefined) metadata.exam_date = patch.examDate;
  if (patch.conceptIds !== undefined) metadata.conceptIds = patch.conceptIds;
  if (
    patch.subjects !== undefined ||
    patch.preferredDays !== undefined ||
    patch.difficulty !== undefined ||
    patch.examDate !== undefined ||
    patch.conceptIds !== undefined
  ) {
    update.generated_from = metadata;
  }

  return update;
}

export function isValidPlanCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
