import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { apiErrorResponse } from "@/lib/api-error";
import { runLordJson } from "@/lib/lord/llm";
import { canAccessWhatIfScenario } from "@/lib/what-if/permissions";
import { WhatIfScenarioSchema } from "@/lib/what-if/scenarios";

const GenerateRequestSchema = z.object({
  action: z.literal("generate"),
  objective: z.string().trim().min(3).max(2_000),
  constraints: z.array(z.string().trim().min(1).max(300)).max(12),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(12),
  proposedOptions: z.array(z.string().trim().min(1).max(100)).max(6),
  timeHorizonMonths: z.number().int().min(1).max(600),
  priority: z.enum(["cost", "effort", "risk"]),
  sensitivityPercent: z.number().finite().min(0).max(100),
});

const RequestSchema = z.discriminatedUnion("action", [
  GenerateRequestSchema,
  z.object({
    action: z.literal("save"),
    scenario: WhatIfScenarioSchema,
    scenarioGroupId: z.string().uuid().optional(),
  }),
  z.object({ action: z.literal("duplicate"), scenarioId: z.string().uuid() }),
]);

const GeneratedOptionsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        approach: z.string().trim().min(1).max(600),
        benefits: z.array(z.string().trim().min(1).max(300)).max(12),
        disadvantages: z.array(z.string().trim().min(1).max(300)).max(12),
        dependencies: z.array(z.string().trim().min(1).max(300)).max(12),
        unresolvedQuestions: z.array(z.string().trim().min(1).max(300)).max(12),
      }),
    )
    .min(3)
    .max(6),
});

type AuthContext = { userId: string; supabase: SupabaseClient<Database> };

export const Route = createFileRoute("/api/what-if")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      GET: async ({ context }) => {
        const auth = context as AuthContext;
        try {
          const { data, error } = await auth.supabase
            .from("lord_what_if_scenarios")
            .select("id, user_id, scenario_group_id, revision, title, data, created_at, updated_at")
            .eq("user_id", auth.userId)
            .order("updated_at", { ascending: false })
            .limit(100);
          if (error) throw error;
          const scenarios = data
            .filter((row) => canAccessWhatIfScenario(row.user_id, auth.userId))
            .map(({ user_id: _ownerId, ...row }) => row);
          return Response.json({ scenarios }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("[what-if] list failed", {
            error: error instanceof Error ? error.message : "unknown",
          });
          return Response.json(
            { error: { code: "WHAT_IF_LOAD_FAILED", message: "Could not load saved scenarios." } },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        const auth = context as AuthContext;
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Request body must be valid JSON.",
            requestId,
          );
        }
        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) {
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Invalid What-If Lab request.",
            requestId,
          );
        }

        try {
          if (parsed.data.action === "generate") {
            const input = parsed.data;
            const completion = await runLordJson<unknown>({
              system:
                "You are LORD AI's scenario design assistant. Return valid JSON with title and 3 to 6 options. Options must represent meaningfully different strategies, not paraphrases. Use only qualitative benefits, disadvantages, dependencies, and unresolved questions. Do not invent facts, prices, effort estimates, citations, or guaranteed outcomes. Explicitly frame uncertain impacts as possibilities. Include user-proposed options as appropriate and add distinct alternatives. Do not execute actions.",
              prompt: JSON.stringify({
                objective: input.objective,
                constraints: input.constraints,
                assumptions: input.assumptions,
                proposedOptions: input.proposedOptions,
              }),
              maxTokens: 3_000,
              signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
              schemaHint:
                '{"title":"...","options":[{"name":"...","approach":"...","benefits":["..."],"disadvantages":["..."],"dependencies":["..."],"unresolvedQuestions":["..."]}]}',
            });
            const generated = GeneratedOptionsSchema.safeParse(completion);
            if (!generated.success) {
              return apiErrorResponse(
                502,
                "WHAT_IF_GENERATION_FAILED",
                "LORD could not create a valid set of distinct options. Please retry.",
                requestId,
              );
            }
            const scenario = WhatIfScenarioSchema.parse({
              title: generated.data.title,
              objective: input.objective,
              constraints: input.constraints,
              assumptions: input.assumptions,
              timeHorizonMonths: input.timeHorizonMonths,
              priority: input.priority,
              sensitivityPercent: input.sensitivityPercent,
              options: generated.data.options.map((option) => ({
                id: crypto.randomUUID(),
                ...option,
                sourceReferences: [],
                upfrontCost: 0,
                monthlyCost: 0,
                effortHours: 0,
                risk: 3,
              })),
            });
            return Response.json(
              { scenario, modelContentType: "qualitative-hypothesis" },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (parsed.data.action === "duplicate") {
            const { data: source, error: readError } = await auth.supabase
              .from("lord_what_if_scenarios")
              .select("user_id, title, data")
              .eq("id", parsed.data.scenarioId)
              .eq("user_id", auth.userId)
              .maybeSingle();
            if (readError) throw readError;
            if (!source || !canAccessWhatIfScenario(source.user_id, auth.userId)) {
              return apiErrorResponse(404, "NOT_FOUND", "Scenario not found.", requestId);
            }
            const { data, error } = await auth.supabase
              .from("lord_what_if_scenarios")
              .insert({
                user_id: auth.userId,
                scenario_group_id: crypto.randomUUID(),
                revision: 1,
                title: `${source.title} (copy)`.slice(0, 120),
                data: source.data,
              })
              .select("id, scenario_group_id, revision, title, data, created_at, updated_at")
              .single();
            if (error) throw error;
            return Response.json({ saved: data }, { headers: { "Cache-Control": "no-store" } });
          }

          const input = parsed.data;
          const scenarioGroupId = input.scenarioGroupId ?? crypto.randomUUID();
          let revision = 1;
          if (input.scenarioGroupId) {
            const { data: previous, error } = await auth.supabase
              .from("lord_what_if_scenarios")
              .select("revision")
              .eq("scenario_group_id", input.scenarioGroupId)
              .eq("user_id", auth.userId)
              .order("revision", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (error) throw error;
            if (!previous) {
              return apiErrorResponse(
                404,
                "NOT_FOUND",
                "Scenario revision group not found.",
                requestId,
              );
            }
            revision = previous.revision + 1;
          }
          const { data: saved, error } = await auth.supabase
            .from("lord_what_if_scenarios")
            .insert({
              user_id: auth.userId,
              scenario_group_id: scenarioGroupId,
              revision,
              title: input.scenario.title,
              data: input.scenario,
            })
            .select("id, scenario_group_id, revision, title, data, created_at, updated_at")
            .single();
          if (error) throw error;
          return Response.json({ saved }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("[what-if] request failed", {
            requestId,
            action: parsed.data.action,
            error: error instanceof Error ? error.message : "unknown",
          });
          return apiErrorResponse(
            500,
            "WHAT_IF_ERROR",
            "What-If Lab could not complete the request.",
            requestId,
          );
        }
      },
    },
  },
});
