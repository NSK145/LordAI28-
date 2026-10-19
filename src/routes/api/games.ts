/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase schema is added by this migration and generated database types are maintained separately. */
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import { OPENROUTER_DEFAULT_MODEL } from "@/lib/openrouter-provider";
import { validateGameSpec, type GameSpec } from "@/lib/games/game-runtime";

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    prompt: z.string().trim().min(8).max(1200),
    difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
  }),
  z.object({
    action: z.literal("modify"),
    spec: z.unknown(),
    instruction: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("save"),
    id: z.string().uuid().optional(),
    spec: z.unknown(),
    prompt: z.string().max(1200),
    versions: z.array(z.unknown()).max(20).optional(),
  }),
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("get"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

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
    model: provider()(process.env.LORD_GAME_MODEL ?? OPENROUTER_DEFAULT_MODEL),
    system: `Design a playable 2D game for a fixed endless runner engine. Return ONLY valid JSON with keys schemaVersion (1), title (<=60 chars), description, genre (runner|dodge), theme, difficulty (easy|normal|hard), objective (<=140 chars), controls (array of strings), seed (integer). The engine implements a jumping runner with obstacle collision and collectibles. Use genre dodge if the prompt asks for dodging or racing; otherwise runner. Never claim unsupported features such as multiplayer, 3D, levels, puzzles, shooter mechanics, or audio. Use safe plain text.`,
    prompt: existing
      ? `Current game specification: ${JSON.stringify(existing)}\nChange requested: ${instruction}\nPreserve other fields and return a complete updated spec.`
      : `Create a game from this idea: ${prompt}\nRequested difficulty: ${difficulty}`,
    maxOutputTokens: 500,
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
        try {
          const body = await request.json();
          const input = RequestSchema.safeParse(body);
          if (!input.success)
            return Response.json({ error: "Invalid game request." }, { status: 400 });
          const op = input.data;
          if (op.action === "generate")
            return Response.json({ spec: await generateSpec(op.prompt, op.difficulty) });
          if (op.action === "modify") {
            if (!validateGameSpec(op.spec))
              return Response.json({ error: "Invalid game specification." }, { status: 400 });
            return Response.json({
              spec: await generateSpec("", op.spec.difficulty, op.spec, op.instruction),
            });
          }
          if (op.action === "list") {
            const { data, error } = await db
              .from("ai_games")
              .select("id,spec,prompt,versions,created_at,updated_at")
              .eq("user_id", userId)
              .order("updated_at", { ascending: false })
              .limit(50);
            if (error) throw error;
            return Response.json({ games: data ?? [] });
          }
          if (op.action === "get") {
            const { data, error } = await db
              .from("ai_games")
              .select("id,spec,prompt,versions,created_at,updated_at")
              .eq("user_id", userId)
              .eq("id", op.id)
              .maybeSingle();
            if (error) throw error;
            if (!data) return Response.json({ error: "Game not found." }, { status: 404 });
            return Response.json({ game: data });
          }
          if (op.action === "delete") {
            const { error, count } = await db
              .from("ai_games")
              .delete({ count: "exact" })
              .eq("user_id", userId)
              .eq("id", op.id);
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
          };
          const query = op.id
            ? db.from("ai_games").update(payload).eq("user_id", userId).eq("id", op.id)
            : db.from("ai_games").insert(payload);
          const { data, error } = await query
            .select("id,spec,prompt,versions,created_at,updated_at")
            .single();
          if (error) throw error;
          return Response.json({ game: data });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Game service failed.";
          const status = message.includes("OPENROUTER_API_KEY") ? 503 : 500;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
