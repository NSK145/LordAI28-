import { describe, expect, it } from "vitest";
import type { Json } from "@/integrations/supabase/types";
import { createMissionStore, type MissionDatabase } from "./mission-store.server";
import type { MissionRecord } from "./mission-store.server";

function createDatabaseFixture() {
  const filters: Array<[string, string | number]> = [];
  const calls: Array<[string, unknown]> = [];
  let pendingUpdate: Record<string, unknown> | null = null;
  let row = {
    id: "mission-123",
    user_id: "owner-123",
    objective: "Explain closures",
    status: "planned",
    plan: {
      title: "Explain closures",
      summary: "Provide an explanation.",
      questions: [],
      steps: [
        {
          id: "answer",
          action: "study.explain",
          arguments: { question: "What is a closure?" },
          description: "Explain closures",
          expectedResult: "A clear explanation",
          dependencies: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 1, recoverableOnly: true },
          requiresApproval: false,
          status: "pending",
          attempts: 0,
        },
      ],
    } as unknown as Json,
    result: null,
    execution_lease_until: null,
    revision: 0,
    created_at: "2026-10-24T00:00:00.000Z",
    updated_at: "2026-10-24T00:00:00.000Z",
  };
  const query = {
    select(columns: string) {
      calls.push(["select", columns]);
      return query;
    },
    eq(column: string, value: string | number) {
      filters.push([column, value]);
      return query;
    },
    order() {
      return query;
    },
    limit: async () => ({ data: [row], error: null }),
    insert(values: Record<string, unknown>) {
      calls.push(["insert", values]);
      return query;
    },
    update(values: Record<string, unknown>) {
      calls.push(["update", values]);
      pendingUpdate = values;
      return query;
    },
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => {
      const matches = filters.every(([column, value]) => {
        const rowValue = row[column as keyof typeof row];
        return rowValue === value;
      });
      filters.length = 0;
      if (!matches) return { data: null, error: null };
      if (pendingUpdate) {
        row = { ...row, ...pendingUpdate } as typeof row;
        pendingUpdate = null;
      }
      return { data: row, error: null };
    },
  };
  const db: MissionDatabase = { from: () => query };
  return { db, calls, filters };
}

function record(): MissionRecord {
  const { db } = createDatabaseFixture();
  return {
    id: "mission-123",
    userId: "owner-123",
    objective: "Explain closures",
    status: "planned",
    plan: {
      title: "Explain closures",
      summary: "Provide an explanation.",
      questions: [],
      steps: [
        {
          id: "answer",
          action: "study.explain",
          arguments: { question: "What is a closure?" },
          description: "Explain closures",
          expectedResult: "A clear explanation",
          dependencies: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 1, recoverableOnly: true },
          requiresApproval: false,
          status: "completed",
          attempts: 1,
          result: { content: "A closure captures its lexical environment." },
        },
      ],
    },
    result: null,
    executionLeaseUntil: null,
    revision: 0,
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  };
}

describe("mission persistence", () => {
  it("scopes mission reads by both ID and authenticated owner", async () => {
    const { db, filters } = createDatabaseFixture();
    const store = createMissionStore(db);

    const notOwned = await store.get("mission-123", "other-user");
    expect(notOwned).toBeNull();
    expect(filters).toEqual([]);
    const owned = await store.get("mission-123", "owner-123");
    expect(owned?.userId).toBe("owner-123");
  });

  it("uses a revision compare-and-swap for durable progress updates", async () => {
    const { db, calls } = createDatabaseFixture();
    const store = createMissionStore(db);
    const next = record();
    next.status = "completed";
    const saved = await store.compareAndSwap(next, 0);

    expect(saved?.revision).toBe(1);
    expect(saved?.status).toBe("completed");
    expect(calls.find(([name]) => name === "update")?.[1]).toMatchObject({
      status: "completed",
      revision: 1,
    });
  });
});
