import type { StoredGameSpec } from "./game-runtime";

const GAME_COLUMNS = "id,spec,prompt,versions,status,created_at,updated_at";

export type PersistedGame = {
  id: string;
  spec: StoredGameSpec | null;
  prompt: string;
  versions: StoredGameSpec[];
  status: "pending" | "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
};

type GameRecordQuery = {
  select(columns: string): GameRecordQuery;
  eq(column: string, value: string): GameRecordQuery;
  insert(values: Record<string, unknown>): GameRecordQuery;
  update(values: Record<string, unknown>): GameRecordQuery;
  single(): Promise<{ data: PersistedGame | null; error: unknown }>;
  maybeSingle(): Promise<{ data: PersistedGame | null; error: unknown }>;
  order(column: string, options: { ascending: boolean }): GameRecordQuery;
  limit(count: number): Promise<{ data: PersistedGame[] | null; error: unknown }>;
};
type GameDatabase = { from(table: "ai_games"): GameRecordQuery };

export class GameServiceError extends Error {
  constructor(
    readonly kind:
      | "auth"
      | "generation"
      | "not_configured"
      | "database"
      | "rate_limited"
      | "model_unavailable"
      | "timeout"
      | "unsupported",
    message: string,
  ) {
    super(message);
    this.name = "GameServiceError";
  }
}

export function ownedGamesQuery(db: GameDatabase, userId: string) {
  return db.from("ai_games").select(GAME_COLUMNS).eq("user_id", userId);
}

export function scopeGameToOwner<Query extends { eq(column: string, value: string): Query }>(
  query: Query,
  userId: string,
  gameId?: string,
): Query {
  const ownerQuery = query.eq("user_id", userId);
  return gameId ? ownerQuery.eq("id", gameId) : ownerQuery;
}

export async function createGameRecord(
  db: GameDatabase,
  input: {
    userId: string;
    prompt: string;
  },
) {
  if (!input.userId) throw new GameServiceError("auth", "Sign in to create a game.");

  try {
    const { data, error } = await db
      .from("ai_games")
      .insert({
        user_id: input.userId,
        spec: null,
        prompt: input.prompt,
        versions: [],
        status: "pending",
      })
      .select(GAME_COLUMNS)
      .single();
    if (error || !data?.id) {
      throw new GameServiceError("database", "The game record could not be created.");
    }
    return data;
  } catch (error) {
    if (error instanceof GameServiceError) throw error;
    throw new GameServiceError("database", "The game record could not be created.");
  }
}

export async function updateGameGeneration(
  db: GameDatabase,
  userId: string,
  gameId: string,
  values: { status: PersistedGame["status"]; spec?: StoredGameSpec | null },
) {
  const { data, error } = await db
    .from("ai_games")
    .update(values)
    .eq("user_id", userId)
    .eq("id", gameId)
    .select(GAME_COLUMNS)
    .single();
  if (error || !data) throw new GameServiceError("database", "The game status could not be saved.");
  return data;
}
