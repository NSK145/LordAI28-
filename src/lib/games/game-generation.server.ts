import "@tanstack/react-start/server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject } from "ai";
import { GamePlannerResponseSchema, planGameSpec } from "@/lib/games/game-generation";
import type { GameSpec, GeneratedGameSpec } from "@/lib/games/game-runtime";

const DEFAULT_GAME_MODEL = "minimax/minimax-m3.1-flash:free";

export async function generateGameSpec(
  prompt: string,
  difficulty: GameSpec["difficulty"],
  existing?: GeneratedGameSpec,
  instruction?: string,
  dimension: "2d" | "3d" = "2d",
  signal?: AbortSignal,
): Promise<GeneratedGameSpec> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("Game generation requires OPENROUTER_API_KEY on the server.");
  const client = createOpenAICompatible({
    name: "openrouter",
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  });

  return planGameSpec({
    prompt,
    difficulty,
    existing,
    instruction,
    dimension,
    generate: async (system, userPrompt) => {
      const response = await generateObject({
        model: client(process.env.LORD_GAME_MODEL ?? DEFAULT_GAME_MODEL),
        system,
        prompt: userPrompt,
        schema: GamePlannerResponseSchema,
        schemaName: "lord_game_spec",
        maxOutputTokens: 3_000,
        maxRetries: 0,
        providerOptions: { openrouter: { reasoningEffort: "low" } },
        abortSignal: AbortSignal.any([
          signal ?? new AbortController().signal,
          AbortSignal.timeout(25_000),
        ]),
      });
      return response.object;
    },
  });
}
