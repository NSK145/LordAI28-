/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/openrouter-provider";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse, apiOkResponse } from "@/lib/api-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGeneratedStudyPlan } from "@/lib/learning/plan-generator";

const GenerateSchema = z.object({
  conceptIds: z
    .array(z.string().min(1))
    .min(1)
    .max(12)
    .refine((ids) => new Set(ids).size === ids.length, "Concept IDs must be unique."),
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
  goal: z.string().trim().max(2000).optional(),
  preferredDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
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

        const { data: existingPlan, error: planLookupError } = await db
          .from("learning_plans")
          .select("id")
          .eq("id", params.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (planLookupError) {
          return apiErrorResponse(500, "DB_ERROR", "Could not load the study plan.", requestId);
        }
        if (!existingPlan) {
          return apiErrorResponse(404, "NOT_FOUND", "Plan not found.", requestId);
        }

        const concepts = await Promise.all(
          parsed.data.conceptIds.map((id) => resolveConcept(db, id)),
        );
        const validConcepts = concepts.filter((c): c is any => c !== null);
        if (validConcepts.length !== parsed.data.conceptIds.length) {
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
        const preferredDays = parsed.data.preferredDays?.length
          ? parsed.data.preferredDays
          : [0, 1, 2, 3, 4, 5, 6];
        const dailyMinutes = parsed.data.dailyMinutes ?? 30;

        const { data: mastery, error: masteryError } = await db
          .from("learning_mastery")
          .select("*")
          .eq("user_id", userId);
        if (masteryError) {
          return apiErrorResponse(500, "DB_ERROR", "Could not load your mastery data.", requestId);
        }

        const masteryMap = new Map((mastery ?? []).map((m: any) => [m.concept_id, m]));

        let generatedText: string;
        try {
          const conceptContext = validConcepts.map((concept: any) => ({
            id: concept.id,
            title: concept.title,
            subject: concept.subject,
            grade: concept.grade_band,
            curriculum: concept.framework,
            description: concept.description,
            masteryPercent: Math.round((masteryMap.get(concept.id)?.score ?? 0.3) * 100),
          }));
          const result = await generateText({
            model: getProvider()(OPENROUTER_DEFAULT_MODEL),
            system:
              "You are LORD, a careful study coach. Create a practical, grade-appropriate study schedule from the supplied concepts and constraints. Return only valid JSON matching the requested shape. Do not invent concept IDs or promise outcomes.",
            prompt: `Create a study plan named "${parsed.data.planName ?? "Study plan"}".
Start date: ${startDateText}
Target date: ${targetDateText} (${daysAvailable} calendar days)
Daily study-time limit: ${dailyMinutes} minutes
Weekly study time: ${parsed.data.weeklyMinutes} minutes
Exam date: ${parsed.data.examDate ?? "not specified"}
Preferred difficulty: ${parsed.data.difficulty ?? "medium"}
Student goal: ${parsed.data.goal ?? parsed.data.planName ?? "Steady mastery"}
Preferred weekdays: ${preferredDays.join(", ")} (0=Sunday)
Concepts and current mastery: ${JSON.stringify(conceptContext)}

Make 1 to 4 useful tasks for every selected concept, covering learning, practice, and spaced review when the schedule allows. Schedule tasks only on preferred weekdays and within the date range. Do not exceed the daily study-time limit in total. Use lower mastery to guide priority and early practice. Use realistic student activities, not vague tasks.

Return JSON exactly as {"tasks":[{"conceptId":"one supplied id","taskType":"learn","dayOffset":0,"estimatedMinutes":20,"title":"Specific task title","description":"What the student should do","priority":"high"}]}. taskType must be exactly one of learn, practice, review, quiz, or flashcards. priority must be exactly high, medium, or low. dayOffset is the number of days after the start date.`,
            maxOutputTokens: 4000,
            temperature: 0.3,
            maxRetries: 1,
          });
          generatedText = result.text;
        } catch (error) {
          console.error("Study plan generation failed:", error);
          return apiErrorResponse(
            503,
            "AI_UPSTREAM_ERROR",
            "LORD could not generate a study plan right now. Please retry.",
            requestId,
          );
        }

        const generatedPlan = normalizeGeneratedStudyPlan(generatedText, {
          allowedConceptIds: validConcepts.map((concept: any) => concept.id),
          startDate,
          daysAvailable,
          dailyMinutes,
          preferredDays,
        });
        if (!generatedPlan.ok) {
          return apiErrorResponse(502, "AI_INVALID_OUTPUT", generatedPlan.message, requestId);
        }
        const tasks = generatedPlan.tasks;

        const { data: previousTasks, error: previousTasksError } = await db
          .from("learning_plan_tasks")
          .select("id")
          .eq("plan_id", params.id)
          .eq("user_id", userId);
        if (previousTasksError) {
          return apiErrorResponse(
            500,
            "DB_ERROR",
            "Could not load the current plan tasks.",
            requestId,
          );
        }

        const { data: insertedTasks, error: insertError } = await db
          .from("learning_plan_tasks")
          .insert(
            tasks.map((task) => ({
              ...task,
              plan_id: params.id,
              user_id: userId,
            })),
          )
          .select("id");

        if (insertError) return apiErrorResponse(500, "DB_ERROR", insertError.message, requestId);

        const previousIds = (previousTasks ?? []).map((task: { id: string }) => task.id);
        if (previousIds.length > 0) {
          const { error: deleteError } = await db
            .from("learning_plan_tasks")
            .delete()
            .in("id", previousIds)
            .eq("user_id", userId);
          if (deleteError) {
            const insertedIds = (insertedTasks ?? []).map((task: { id: string }) => task.id);
            let rollbackFailed = false;
            if (insertedIds.length > 0) {
              const { error: rollbackError } = await db
                .from("learning_plan_tasks")
                .delete()
                .in("id", insertedIds)
                .eq("user_id", userId);
              rollbackFailed = Boolean(rollbackError);
            }
            return apiErrorResponse(
              500,
              "DB_ERROR",
              rollbackFailed
                ? "New tasks were saved but could not be rolled back after replacement failed. Refresh the plan and remove any duplicates."
                : "Previous tasks could not be replaced. The existing schedule is still available; retry generation.",
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
        const { data: updatedPlan, error: updateError } = await db
          .from("learning_plans")
          .update(updatePayload)
          .eq("id", params.id)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (updateError || !updatedPlan) {
          return apiErrorResponse(
            500,
            "DB_ERROR",
            "The new tasks were saved, but plan details could not be updated. Refresh the plan before continuing.",
            requestId,
          );
        }

        return apiOkResponse({ plan: updatedPlan, tasks, count: tasks.length });
      },
    },
  },
});

function parseCalendarDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
