/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse, apiOkResponse, apiNoContentResponse } from "@/lib/api-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStudyPlanUpdate, isValidPlanCalendarDate } from "@/lib/learning/plan-updates";

const UpdatePlanSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dailyMinutes: z.number().int().min(5).max(480).optional(),
    status: z.enum(["active", "paused", "completed", "archived"]).optional(),
    source: z.enum(["manual", "ai", "mixed"]).optional(),
    subjects: z.array(z.string()).optional(),
    preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .superRefine((patch, ctx) => {
    for (const field of ["startDate", "targetDate", "examDate"] as const) {
      const value = patch[field];
      if (typeof value === "string" && !isValidPlanCalendarDate(value)) {
        ctx.addIssue({ code: "custom", path: [field], message: `Invalid ${field}.` });
      }
    }
    if (patch.startDate && patch.targetDate && patch.targetDate < patch.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Target date must be on or after the start date.",
      });
    }
  });

export const Route = createFileRoute("/api/study-plans/$id")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      GET: async ({ params, context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as { userId?: string; supabase?: SupabaseClient<any> };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in required.", requestId);

        const { data, error } = await auth.supabase
          .from("learning_plans")
          .select("*, learning_plan_tasks(*)")
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .single();

        if (error || !data) return apiErrorResponse(404, "NOT_FOUND", "Plan not found.", requestId);

        const tasks = (data.learning_plan_tasks ?? [])
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((t: any) => ({
            ...t,
            due_at: t.due_at,
          }));

        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.status === "completed").length;
        const remainingMinutes = tasks
          .filter((t: any) => t.status !== "completed")
          .reduce((sum: number, t: any) => sum + (t.estimated_minutes ?? 0), 0);

        const dailyMap = new Map<string, number>();
        for (const t of tasks) {
          const day = new Date(t.due_at).toISOString().slice(0, 10);
          dailyMap.set(day, (dailyMap.get(day) ?? 0) + (t.estimated_minutes ?? 0));
        }

        return apiOkResponse({
          ...data,
          tasks,
          progress: {
            total,
            completed,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0,
            remainingMinutes,
          },
          dailyWorkload: Array.from(dailyMap.entries()).map(([date, scheduledMinutes]) => ({
            date,
            scheduledMinutes,
            dailyTarget: data.daily_minutes ?? 120,
            overloaded: scheduledMinutes > (data.daily_minutes ?? 120),
            tasks: tasks.filter((t: any) => new Date(t.due_at).toISOString().slice(0, 10) === date),
          })),
        });
      },

      PATCH: async ({ params, request, context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as { userId?: string; supabase?: SupabaseClient<any> };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in required.", requestId);

        const body = await request.json().catch(() => null);
        const parsed = UpdatePlanSchema.safeParse(body);
        if (!parsed.success)
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid plan data.", requestId);

        const { data: currentPlan, error: currentPlanError } = await auth.supabase
          .from("learning_plans")
          .select("starts_on,ends_on,generated_from")
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (currentPlanError) {
          return apiErrorResponse(500, "DB_ERROR", "Could not load the current plan.", requestId);
        }
        if (!currentPlan) return apiErrorResponse(404, "NOT_FOUND", "Plan not found.", requestId);

        const nextStart = parsed.data.startDate ?? currentPlan.starts_on;
        const nextTarget = parsed.data.targetDate ?? currentPlan.ends_on;
        if (nextTarget < nextStart) {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Target date must be on or after the start date.",
            requestId,
          );
        }
        const currentMetadata =
          currentPlan.generated_from && typeof currentPlan.generated_from === "object"
            ? (currentPlan.generated_from as Record<string, unknown>)
            : {};
        const nextExamDate =
          parsed.data.examDate === undefined ? currentMetadata.exam_date : parsed.data.examDate;
        if (typeof nextExamDate === "string" && nextExamDate < nextStart) {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Exam date must be on or after the start date.",
            requestId,
          );
        }

        const update = buildStudyPlanUpdate(parsed.data, currentMetadata);

        const { data, error } = await auth.supabase
          .from("learning_plans")
          .update(update)
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .select("*")
          .single();

        if (error) return apiErrorResponse(500, "DB_ERROR", error.message, requestId);
        if (!data) return apiErrorResponse(404, "NOT_FOUND", "Plan not found.", requestId);
        return apiOkResponse(data);
      },

      DELETE: async ({ params, context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as { userId?: string; supabase?: SupabaseClient<any> };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in required.", requestId);

        const { error } = await auth.supabase
          .from("learning_plans")
          .delete()
          .eq("id", params.id)
          .eq("user_id", auth.userId);

        if (error) return apiErrorResponse(500, "DB_ERROR", error.message, requestId);
        return apiNoContentResponse();
      },
    },
  },
});
