/* eslint-disable @typescript-eslint/no-explicit-any -- server context receives the migration-defined database client. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { apiErrorResponse, apiOkResponse, apiNoContentResponse } from "@/lib/api-error";
import type { SupabaseClient } from "@supabase/supabase-js";

const CreatePlanSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dailyMinutes: z.number().int().min(5).max(480),
    subjects: z.array(z.string()).optional(),
    preferredDays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length, "Study days must be unique.")
      .optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    source: z.enum(["manual", "ai", "mixed"]).default("manual"),
    conceptIds: z.array(z.string()).optional(),
  })
  .superRefine((plan, ctx) => {
    const start = parseCalendarDate(plan.startDate);
    const target = parseCalendarDate(plan.targetDate);
    if (!start) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Invalid start date." });
    }
    if (!target) {
      ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Invalid target date." });
    }
    if (start && target && target.getTime() < start.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Target date must be on or after the start date.",
      });
    }
    if (plan.examDate) {
      const exam = parseCalendarDate(plan.examDate);
      if (!exam) {
        ctx.addIssue({ code: "custom", path: ["examDate"], message: "Invalid exam date." });
      } else if (start && exam.getTime() < start.getTime()) {
        ctx.addIssue({
          code: "custom",
          path: ["examDate"],
          message: "Exam date must be on or after the start date.",
        });
      }
    }
  });

export const Route = createFileRoute("/api/study-plans/")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as { userId?: string; supabase?: SupabaseClient<any> };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in required.", requestId);

        const body = await request.json().catch(() => null);
        const parsed = CreatePlanSchema.safeParse(body);
        if (!parsed.success)
          return apiErrorResponse(400, "INVALID_REQUEST", "Invalid plan data.", requestId);

        const db = auth.supabase;
        const userId = auth.userId;

        const { data, error } = await db
          .from("learning_plans")
          .insert({
            user_id: userId,
            title: parsed.data.title,
            description: parsed.data.description ?? null,
            starts_on: parsed.data.startDate,
            ends_on: parsed.data.targetDate,
            daily_minutes: parsed.data.dailyMinutes,
            status: "active",
            source: parsed.data.source,
            generated_from: {
              ...(parsed.data.conceptIds?.length ? { conceptIds: parsed.data.conceptIds } : {}),
              ...(parsed.data.subjects ? { subjects: parsed.data.subjects } : {}),
              ...(parsed.data.preferredDays ? { preferred_days: parsed.data.preferredDays } : {}),
              ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
              ...(parsed.data.examDate ? { exam_date: parsed.data.examDate } : {}),
            },
          })
          .select("*")
          .single();

        if (error) return apiErrorResponse(500, "DB_ERROR", error.message, requestId);
        return apiOkResponse(data, 201);
      },

      GET: async ({ context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as { userId?: string; supabase?: SupabaseClient<any> };
        if (!auth.userId || !auth.supabase)
          return apiErrorResponse(401, "AI_AUTH_ERROR", "Sign in required.", requestId);

        const { data, error } = await auth.supabase
          .from("learning_plans")
          .select("*")
          .eq("user_id", auth.userId)
          .order("created_at", { ascending: false });

        if (error) return apiErrorResponse(500, "DB_ERROR", error.message, requestId);
        return apiOkResponse(data ?? []);
      },
    },
  },
});

function parseCalendarDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
