import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { embed, cosineSimilarity } from "@/lib/memory/embeddings";
import type { SearchResult, EntityType } from "./types";

const SEARCH_LIMIT = 20;

export async function globalSearch(params: {
  userId: string;
  query: string;
  projectId?: string | null;
  entityTypes?: EntityType[];
  limit?: number;
}): Promise<SearchResult[]> {
  const { userId, query, projectId, entityTypes, limit = SEARCH_LIMIT } = params;

  const queryVec = await embedQueryVector(query);
  const results: SearchResult[] = [];

  const searchIndexResults = await searchIndex(userId, query, queryVec, {
    projectId,
    entityTypes,
    limit,
  });
  results.push(...searchIndexResults);

  const memoryResults = await searchMemories(userId, query, queryVec, {
    projectId,
    limit,
  });
  results.push(...memoryResults);

  results.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const r of results) {
    const key = `${r.entityType}:${r.entityId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }

  return unique.slice(0, limit);
}

async function searchIndex(
  userId: string,
  query: string,
  queryVec: number[] | null,
  opts: {
    projectId?: string | null;
    entityTypes?: EntityType[];
    limit: number;
  },
): Promise<SearchResult[]> {
  let query_builder = supabase
    .from("search_index")
    .select("*")
    .eq("user_id", userId)
    .limit(opts.limit);

  if (opts.projectId) {
    query_builder = query_builder.eq("project_id", opts.projectId);
  }

  if (opts.entityTypes && opts.entityTypes.length > 0) {
    query_builder = query_builder.in("entity_type", opts.entityTypes);
  }

  const { data, error } = await query_builder;
  if (error || !data) return [];

  return data.map((row) => {
    const vec = row.content_vector ? (JSON.parse(row.content_vector as string) as number[]) : null;
    let similarity = 0;
    if (queryVec && vec && vec.length === queryVec.length) {
      similarity = cosineSimilarity(queryVec, vec);
    } else {
      const tokens = tokenize(query);
      const contentTokens = tokenize(row.content + " " + (row.title ?? ""));
      similarity = jaccardSimilarity(tokens, contentTokens);
    }
    const resultTitle = row.title ?? null;
    return {
      id: row.id,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      projectId: row.project_id,
      title: resultTitle,
      content: row.content,
      tags: row.tags ?? [],
      similarity,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at,
    };
  });
}

async function searchMemories(
  userId: string,
  query: string,
  queryVec: number[] | null,
  opts: {
    projectId?: string | null;
    limit: number;
  },
): Promise<SearchResult[]> {
  let query_builder = supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .eq("confirmation_status", "confirmed")
    .eq("use_in_context", true)
    .order("importance", { ascending: false })
    .limit(opts.limit);

  if (opts.projectId) {
    query_builder = query_builder.or(`project_id.eq.${opts.projectId},project_id.is.null`);
  }

  const { data, error } = await query_builder;
  if (error || !data) return [];

  return data.map((row) => {
    const vec = row.embedding_vec ? (JSON.parse(row.embedding_vec as string) as number[]) : null;
    let similarity = 0;
    if (queryVec && vec && vec.length === queryVec.length) {
      similarity = cosineSimilarity(queryVec, vec);
    } else {
      const tokens = tokenize(query);
      const contentTokens = tokenize(row.content ?? "");
      similarity = jaccardSimilarity(tokens, contentTokens);
    }
    return {
      id: row.id,
      entityType: "memory" as EntityType,
      entityId: row.id,
      projectId: row.project_id,
      title: row.content ? row.content.slice(0, 60) : null,
      content: row.content ?? "",
      tags: row.tags ?? [],
      similarity,
      metadata: { category: row.category, confidence: row.confidence, pinned: row.pinned },
      createdAt: row.created_at,
    };
  });
}

async function embedQueryVector(query: string): Promise<number[] | null> {
  try {
    const result = await embed(query);
    return result.vector;
  } catch {
    return null;
  }
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / Math.sqrt(setA.size * setB.size);
}
