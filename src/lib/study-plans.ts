import { getApiBaseUrl } from "./api-config";
import { authenticatedFetch } from "./authenticated-fetch";
import type {
  LearningPlan,
  LearningPlanTask,
  PlanInput,
  PlanTaskInput,
  PlanWithTasks,
  AIProposedChange,
  PlanOptimizationResult,
} from "./learning/types";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Study plans API error: ${response.status} ${errorText}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// Plans CRUD
export async function listStudyPlans(): Promise<LearningPlan[]> {
  return api<LearningPlan[]>("/api/study-plans");
}

export async function getStudyPlan(id: string): Promise<PlanWithTasks> {
  return api<PlanWithTasks>(`/api/study-plans/${encodeURIComponent(id)}`);
}

export async function createStudyPlan(input: PlanInput): Promise<LearningPlan> {
  return api<LearningPlan>("/api/study-plans", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? null,
      startDate: input.startDate,
      targetDate: input.targetDate,
      dailyMinutes: input.dailyMinutes,
      subjects: input.subjects,
      preferredDays: input.preferredDays,
      difficulty: input.difficulty,
      examDate: input.examDate,
      source: input.source ?? "manual",
      conceptIds: input.conceptIds,
    }),
  });
}

export async function updateStudyPlan(
  id: string,
  patch: Partial<PlanInput>,
): Promise<LearningPlan> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.startDate !== undefined) body.startDate = patch.startDate;
  if (patch.targetDate !== undefined) body.targetDate = patch.targetDate;
  if (patch.dailyMinutes !== undefined) body.dailyMinutes = patch.dailyMinutes;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.source !== undefined) body.source = patch.source;
  if (patch.subjects !== undefined) body.subjects = patch.subjects;
  if (patch.preferredDays !== undefined) body.preferredDays = patch.preferredDays;
  if (patch.difficulty !== undefined) body.difficulty = patch.difficulty;
  if (patch.examDate !== undefined) body.examDate = patch.examDate;

  return api<LearningPlan>(`/api/study-plans/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteStudyPlan(id: string): Promise<void> {
  return api<void>(`/api/study-plans/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function archiveStudyPlan(id: string): Promise<LearningPlan> {
  return updateStudyPlan(id, { status: "archived" });
}

export async function pauseStudyPlan(id: string): Promise<LearningPlan> {
  return updateStudyPlan(id, { status: "paused" });
}

export async function duplicateStudyPlan(id: string, newTitle?: string): Promise<LearningPlan> {
  const source = await getStudyPlan(id);
  const suffix = newTitle ? ` (copy)` : "";
  return createStudyPlan({
    title: `${source.title}${suffix}`,
    description: source.description ?? undefined,
    startDate: source.starts_on,
    targetDate: source.ends_on,
    dailyMinutes: source.daily_minutes ?? 120,
    source: "manual",
    conceptIds: source.tasks.filter((t) => t.concept_id).map((t) => t.concept_id!),
  });
}

// Tasks CRUD
export async function addPlanTask(planId: string, input: PlanTaskInput): Promise<LearningPlanTask> {
  return api<LearningPlanTask>(`/api/study-plans/${encodeURIComponent(planId)}/tasks`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? null,
      conceptId: input.conceptId ?? null,
      taskType: input.taskType,
      scheduledDate: input.scheduledDate,
      estimatedMinutes: input.estimatedMinutes,
      priority: input.priority,
      notes: input.notes ?? null,
    }),
  });
}

export async function updatePlanTask(
  planId: string,
  taskId: string,
  patch: Partial<PlanTaskInput> & { status?: string },
): Promise<LearningPlanTask> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.conceptId !== undefined) body.conceptId = patch.conceptId;
  if (patch.taskType !== undefined) body.taskType = patch.taskType;
  if (patch.scheduledDate !== undefined) body.scheduledDate = patch.scheduledDate;
  if (patch.estimatedMinutes !== undefined) body.estimatedMinutes = patch.estimatedMinutes;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.notes !== undefined) body.notes = patch.notes;

  return api<LearningPlanTask>(
    `/api/study-plans/${encodeURIComponent(planId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function deletePlanTask(planId: string, taskId: string): Promise<void> {
  return api<void>(
    `/api/study-plans/${encodeURIComponent(planId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function completePlanTask(planId: string, taskId: string): Promise<LearningPlanTask> {
  return updatePlanTask(planId, taskId, { status: "completed" });
}

export async function skipPlanTask(planId: string, taskId: string): Promise<LearningPlanTask> {
  return updatePlanTask(planId, taskId, { status: "skipped" });
}

export async function reschedulePlanTask(
  planId: string,
  taskId: string,
  newDate: string,
): Promise<LearningPlanTask> {
  return updatePlanTask(planId, taskId, { scheduledDate: newDate });
}

export async function reorderPlanTasks(
  planId: string,
  taskIds: string[],
): Promise<LearningPlanTask[]> {
  const updates = taskIds.map((taskId, index) =>
    updatePlanTask(planId, taskId, { position: index }),
  );
  return Promise.all(updates);
}

// AI operations
export async function suggestPlanChanges(
  planId: string,
  userMessage: string,
): Promise<{ summary: string; changes: AIProposedChange[]; smartSuggestions: string[] }> {
  return api(`/api/study-plans/${encodeURIComponent(planId)}/ai/suggest`, {
    method: "POST",
    body: JSON.stringify({ userMessage }),
  });
}

export async function optimizePlan(planId: string): Promise<PlanOptimizationResult> {
  return api(`/api/study-plans/${encodeURIComponent(planId)}/ai/optimize`, {
    method: "POST",
  });
}

export async function generateAIPlan(
  planId: string,
  options: {
    conceptIds: string[];
    weeklyMinutes?: number;
    examDate?: string;
    planName?: string;
    startDate?: string;
    targetDate?: string;
    dailyMinutes?: number;
    difficulty?: "easy" | "medium" | "hard";
    goal?: string;
    preferredDays?: number[];
  },
): Promise<{ plan: LearningPlan; tasks: LearningPlanTask[]; count: number }> {
  return api(`/api/study-plans/${encodeURIComponent(planId)}/ai/generate`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}
