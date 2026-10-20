/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase schema is added by this migration and generated database types are maintained separately. */
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { validateGameSpec, type GameSpec } from "@/lib/games/game-runtime";
import {
  createGameRecord,
  GameServiceError,
  ownedGamesQuery,
  scopeGameToOwner,
  updateGameGeneration,
} from "@/lib/games/game-service";
import { GameRequestSchema } from "@/lib/games/game-request-schema";
import { generationFailure, upstreamStatus } from "@/lib/games/game-errors";

const DEFAULT_GAME_MODEL = "minimax/minimax-m3.1-flash:free";

function provider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Game generation requires OPENROUTER_API_KEY on the server.");
  return createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  });
}
async function generateSpec(
  prompt: string,
  difficulty: GameSpec["difficulty"],
  existing?: GameSpec,
  instruction?: string,
): Promise<GameSpec> {
  const { text } = await generateText({
    model: provider()(process.env.LORD_GAME_MODEL ?? DEFAULT_GAME_MODEL),
    system: `Design a playable 2D game for a fixed endless runner engine. Return ONLY valid JSON with keys schemaVersion (1), title (<=60 chars), description, genre (runner|dodge), theme, difficulty (easy|normal|hard), objective (<=140 chars), controls (array of strings), seed (integer). The engine implements a jumping runner with obstacle collision and collectibles. Use genre dodge if the prompt asks for dodging or racing; otherwise runner. Never claim unsupported features such as multiplayer, 3D, levels, puzzles, shooter mechanics, or audio. Use safe plain text.`,
    prompt: existing
      ? `Current game specification: ${JSON.stringify(existing)}\nChange requested: ${instruction}\nPreserve other fields and return a complete updated spec.`
      : `Create a game from this idea: ${prompt}\nRequested difficulty: ${difficulty}`,
    maxOutputTokens: 500,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(25_000),
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("The game model returned an invalid specification. Please retry.");
  }
  if (!validateGameSpec(parsed))
    throw new Error("The generated game specification failed validation. Please retry.");
  return parsed;
}

export const Route = createFileRoute("/api/games")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const { userId, supabase } = context as { userId: string; supabase: unknown };
        const db = supabase as any;
        let action = "unknown";
        let gameId: string | undefined;
        const requestId = crypto.randomUUID();
        try {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." } },
              { status: 400 },
            );
          }
          const input = GameRequestSchema.safeParse(body);
          if (!input.success)
            return Response.json(
              { error: { code: "INVALID_REQUEST", message: "Invalid game request." } },
              { status: 400 },
            );
          const op = input.data;
          action = op.action;
          if (op.action === "generate") {
            const game = await createGameRecord(db, {
              userId,
              prompt: op.prompt,
            });
            gameId = game.id;
            await updateGameGeneration(db, userId, game.id, { status: "generating" });
            let spec: GameSpec;
            try {
              spec = await generateSpec(op.prompt, op.difficulty);
            } catch (error) {
              const failure = generationFailure(error);
              console.error("[games] upstream generation failed", {
                requestId,
                gameId,
                model: process.env.LORD_GAME_MODEL ?? DEFAULT_GAME_MODEL,
                upstreamStatus: upstreamStatus(error) ?? null,
                errorName: error instanceof Error ? error.name : "unknown",
                failureType: failure.kind,
              });
              try {
                await updateGameGeneration(db, userId, game.id, { status: "failed" });
              } catch {
                console.error("[games] failed to persist failure status", { requestId, gameId });
              }
              throw failure;
            }
            const readyGame = await updateGameGeneration(db, userId, game.id, {
              status: "ready",
              spec,
            });
            return Response.json({ game: readyGame });
          }
          if (op.action === "modify") {
            if (!validateGameSpec(op.spec))
              return Response.json({ error: "Invalid game specification." }, { status: 400 });
            return Response.json({
              spec: await generateSpec("", op.spec.difficulty, op.spec, op.instruction),
            });
          }
          if (op.action === "list") {
            const { data, error } = await ownedGamesQuery(db, userId)
              .eq("status", "ready")
              .order("updated_at", { ascending: false })
              .limit(50);
            if (error) throw error;
            return Response.json({ games: data ?? [] });
          }
          if (op.action === "get") {
            const { data, error } = await ownedGamesQuery(db, userId)
              .eq("status", "ready")
              .eq("id", op.id)
              .maybeSingle();
            if (error) throw error;
            if (!data) return Response.json({ error: "Game not found." }, { status: 404 });
            return Response.json({ game: data });
          }
          if (op.action === "delete") {
            const { error, count } = await scopeGameToOwner(
              db.from("ai_games").delete({ count: "exact" }),
              userId,
              op.id,
            );
            if (error) throw error;
            if (!count) return Response.json({ error: "Game not found." }, { status: 404 });
            return Response.json({ ok: true });
          }
          if (!validateGameSpec(op.spec))
            return Response.json({ error: "Invalid game specification." }, { status: 400 });
          const payload = {
            user_id: userId,
            spec: op.spec,
            prompt: op.prompt,
            versions: op.versions ?? [],
            status: "ready",
          };
          const query = op.id
            ? scopeGameToOwner(db.from("ai_games").update(payload), userId, op.id)
            : db.from("ai_games").insert(payload);
          const { data, error } = await query
            .select("id,spec,prompt,versions,created_at,updated_at")
            .single();
          if (error) throw error;
          return Response.json({ game: data });
        } catch (error) {
          if (error instanceof GameServiceError) {
            console.warn("[games] operation failed", {
              requestId,
              action,
              failureType: error.kind,
            });
            const statusByKind = {
              auth: 401,
              generation: 502,
              database: 500,
              not_configured: 503,
              rate_limited: 429,
              model_unavailable: 503,
              timeout: 504,
            } as const;
            const codeByKind = {
              auth: "AI_AUTH_ERROR",
              generation: "AI_GENERATION_FAILED",
              database: "DB_ERROR",
              not_configured: "AI_NOT_CONFIGURED",
              rate_limited: "AI_RATE_LIMITED",
              model_unavailable: "AI_MODEL_UNAVAILABLE",
              timeout: "AI_TIMEOUT",
            } as const;
            return Response.json(
              { error: { code: codeByKind[error.kind], message: error.message, requestId, gameId } },
              {
                status: statusByKind[error.kind],
                headers: error.kind === "rate_limited" ? { "Retry-After": "30" } : undefined,
              },
            );
          }
          const isGenerationAction = action === "generate" || action === "modify";
          const classifiedFailure = isGenerationAction ? generationFailure(error) : null;
          console.error("[games] request failed", {
            requestId,
            gameId,
            action,
            failureType: classifiedFailure?.kind ?? "database_or_request",
            upstreamStatus: upstreamStatus(error) ?? null,
            errorName: error instanceof Error ? error.name : "unknown",
          });
          return Response.json(
            {
              error: {
                code: classifiedFailure?.kind === "not_configured"
                  ? "AI_NOT_CONFIGURED"
                  : classifiedFailure?.kind === "rate_limited"
                    ? "AI_RATE_LIMITED"
                    : classifiedFailure?.kind === "timeout"
                      ? "AI_TIMEOUT"
                      : classifiedFailure?.kind === "model_unavailable"
                        ? "AI_MODEL_UNAVAILABLE"
                  : isGenerationAction
                          ? "AI_GENERATION_FAILED"
                          : "DB_ERROR",
                message: classifiedFailure?.message ??
                  (isGenerationAction
                    ? "Game generation failed. Please try again."
                    : "The game could not be saved or loaded. Please try again."),
                requestId,
                gameId,
              },
            },
            {
              status: classifiedFailure
                ? classifiedFailure.kind === "generation"
                  ? 502
                  : classifiedFailure.kind === "rate_limited"
                    ? 429
                    : classifiedFailure.kind === "timeout"
                      ? 504
                      : 503
                : 500,
              headers: classifiedFailure?.kind === "rate_limited" ? { "Retry-After": "30" } : undefined,
            },
          );
        }
      },
    },
  },
});
