/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse, apiOkResponse } from "@/lib/api-error";
import type { SupabaseClient } from "@supabase/supabase-js";

const GenerateSchema = z.object({
  conceptIds: z.array(z.string()).min(1).max(12),
  weeklyMinutes: z.number().int().min(30).max(1680).default(180),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  planName: z.string().min(1).max(200).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dailyMinutes: z.number().int().min(5).max(480).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

function getProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI not configured");
  return createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  });
}

async function resolveConcept(db: any, conceptId: string) {
  const { data: catalog } = await db
    .from("learning_concepts")
    .select("*")
    .eq("id", conceptId)
    .maybeSingle();
  if (catalog) return { ...catalog, is_custom: false };
  const { data: custom } = await db
    .from("learning_user_concepts")
    .select("*")
    .eq("id", conceptId)
    .maybeSingle();
  if (!custom) return null;
  return { ...custom, is_custom: true };
}

export const Route = createFileRoute("/api/study-plans/$id/ai/generate")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ params, request, context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as { userId?: string; supabase?: SupabaseClient<any> };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in required.", requestId);

        const body = await request.json().catch(() => null);
        const parsed = GenerateSchema.safeParse(body);
        if (!parsed.success)
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid generation request.", requestId);

        const db = auth.supabase;
        const userId = auth.userId;

        const concepts = await Promise.all(
          parsed.data.conceptIds.map((id) => resolveConcept(db, id)),
        );
        const validConcepts = concepts.filter((c): c is any => c !== null);
        if (validConcepts.length === 0) {
          return apiErrorResponse(
            404,
            "NOT_FOUND",
            "No valid study concepts were found.",
            requestId,
          );
        }

        const today = new Date().toISOString().slice(0, 10);
        const startDateText = parsed.data.startDate ?? today;
        const startDate = parseCalendarDate(startDateText);
        if (!startDate) {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Plan dates must be valid calendar dates.",
            requestId,
          );
        }
        const targetDateText =
          parsed.data.targetDate ??
          new Date(startDate.getTime() + 30 * 86400000).toISOString().slice(0, 10);
        const targetDate = parseCalendarDate(targetDateText);
        if (!targetDate) {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Plan dates must be valid calendar dates.",
            requestId,
          );
        }
        if (targetDate.getTime() < startDate.getTime()) {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "The target date must be on or after the plan start date.",
            requestId,
          );
        }
        const daysAvailable = Math.max(
          1,
          Math.floor((targetDate.getTime() - startDate.getTime()) / 86400000) + 1,
        );
        const totalMinutes = parsed.data.dailyMinutes
          ? parsed.data.dailyMinutes * daysAvailable
          : parsed.data.weeklyMinutes * Math.max(1, Math.ceil(daysAvailable / 7));

        const { data: mastery } = await db
          .from("learning_mastery")
          .select("*")
          .eq("user_id", userId);

        const masteryMap = new Map((mastery ?? []).map((m: any) => [m.concept_id, m]));

        const tasks: any[] = [];
        const taskTypes = ["learn", "practice", "review"] as const;
        let pos = 0;

        for (const [conceptIndex, concept] of validConcepts.entries()) {
          const m = masteryMap.get(concept.id);
          const score = m?.score ?? 0.3;
          const baseMinutes = concept.estimated_study_minutes ?? 20;
          const typeIndex = score < 0.4 ? 0 : score < 0.7 ? 1 : 2;
          const taskType = taskIndexToTaskType(typeIndex);

          tasks.push({
            concept_id: concept.id,
            title: `${capitalize(taskType)}: ${concept.title}`,
            description: concept.description ?? null,
            task_type: taskType,
            due_at: new Date(
              startDate.getTime() +
                Math.floor((conceptIndex * daysAvailable) / validConcepts.length) * 86400000,
            ).toISOString(),
            estimated_minutes: Math.max(
              5,
              Math.min(
                baseMinutes,
                parsed.data.dailyMinutes ?? 30,
                Math.floor(totalMinutes / validConcepts.length),
              ),
            ),
            priority: score < 0.4 ? "high" : score < 0.7 ? "medium" : "low",
            status: "pending",
            position: pos,
            notes: null,
          });
          pos++;
        }

        const { data: existingPlan } = await db
          .from("learning_plans")
          .select("id")
          .eq("id", params.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingPlan) {
          return apiErrorResponse(404, "NOT_FOUND", "Plan not found.", requestId);
        }

        const { data: previousTasks } = await db
          .from("learning_plan_tasks")
          .select("id")
          .eq("plan_id", params.id)
          .eq("user_id", userId);

        const { error: insertError } = await db.from("learning_plan_tasks").insert(
          tasks.map((t) => ({
            ...t,
            plan_id: params.id,
            user_id: userId,
          })),
        );

        if (insertError) return apiErrorResponse(500, "DB_ERROR", insertError.message, requestId);

        const previousIds = (previousTasks ?? []).map((task: { id: string }) => task.id);
        if (previousIds.length > 0) {
          const { error: deleteError } = await db
            .from("learning_plan_tasks")
            .delete()
            .in("id", previousIds)
            .eq("user_id", userId);
          if (deleteError) {
            return apiErrorResponse(
              500,
              "DB_ERROR",
              "New tasks were saved, but previous tasks could not be replaced. Refresh the plan before trying again.",
              requestId,
            );
          }
        }

        const updatePayload: Record<string, unknown> = {
          source: "ai",
          updated_at: new Date().toISOString(),
        };
        if (parsed.data.planName) updatePayload.title = parsed.data.planName;
        if (parsed.data.startDate) updatePayload.starts_on = parsed.data.startDate;
        if (parsed.data.targetDate) updatePayload.ends_on = parsed.data.targetDate;
        if (parsed.data.dailyMinutes) updatePayload.daily_minutes = parsed.data.dailyMinutes;
        const { data: updatedPlan } = await db
          .from("learning_plans")
          .update(updatePayload)
          .eq("id", params.id)
          .eq("user_id", userId)
          .select("*")
          .single();

        return apiOkResponse({ plan: updatedPlan, tasks, count: tasks.length });
      },
    },
  },
});

function taskIndexToTaskType(
  index: number,
): "learn" | "practice" | "review" | "quiz" | "flashcards" | "custom" {
  const types: Array<"learn" | "practice" | "review" | "quiz" | "flashcards" | "custom"> = [
    "learn",
    "practice",
    "review",
    "quiz",
    "flashcards",
    "custom",
  ];
  return types[index] ?? "learn";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseCalendarDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
