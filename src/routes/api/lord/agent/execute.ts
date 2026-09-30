import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { buildMemoryPrompt } from "@/routes/api/chat/-memory";
import { runAgent } from "@/lib/lord/api";
import { persistProjectOutcome } from "@/lib/lord/project-memory";
import { createAgentProgressResponse } from "@/lib/lord/stream";
import { apiErrorResponse } from "@/lib/api-error";

export const Route = createFileRoute("/api/lord/agent/execute")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        try {
          const body = (await request.json().catch(() => ({}))) as {
            command?: string;
            planId?: string;
            approvedStepIds?: string[] | "all";
          };
          const auth = context as {
            userId?: string;
            supabase?: Parameters<typeof buildMemoryPrompt>[0];
          };
          const userId = auth.userId;
          const memoryPrompt =
            !body.planId && userId && auth.supabase
              ? await buildMemoryPrompt(auth.supabase, userId, body.command ?? "")
              : "";

          const runAndRemember = async (
            onProgress?: Parameters<typeof runAgent>[2],
            signal?: AbortSignal,
          ) => {
            const result = await runAgent(body, userId, onProgress, memoryPrompt, signal);
            if (userId && auth.supabase) {
              await persistProjectOutcome(auth.supabase, userId, result);
            }
            return result;
          };

          if (request.headers.get("accept")?.includes("text/event-stream")) {
            return createAgentProgressResponse(runAndRemember, request.signal);
          }
          const result = await runAndRemember(undefined, request.signal);
          return Response.json(
            { ...result, requestId },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          return apiErrorResponse(
            500,
            "INTERNAL_ERROR",
            err instanceof Error ? err.message : "Agent execution failed",
            requestId,
          );
        }
      },
    },
  },
});
