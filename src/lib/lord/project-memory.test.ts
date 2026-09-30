import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AgentExecuteResult } from "./types";
import { persistProjectOutcome } from "./project-memory";

function makeClient(
  options: {
    enabled?: boolean;
    duplicate?: boolean;
    settingsError?: boolean;
  } = {},
) {
  const settingQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.enabled === undefined ? null : { memory_enabled: options.enabled },
      error: options.settingsError ? { message: "settings unavailable" } : null,
    }),
  };
  settingQuery.select.mockReturnValue(settingQuery);
  settingQuery.eq.mockReturnValue(settingQuery);

  const memoryQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.duplicate ? { id: "existing" } : null,
      error: null,
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  memoryQuery.select.mockReturnValue(memoryQuery);
  memoryQuery.eq.mockReturnValue(memoryQuery);

  const from = vi.fn((table: string) => (table === "memory_settings" ? settingQuery : memoryQuery));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    memoryQuery,
  };
}

function completedResult(intent: string): AgentExecuteResult {
  return {
    status: "completed",
    intent,
    steps: [
      {
        id: "step-1",
        tool: "files.write_text",
        params: {},
        risk: "high",
        intent: "Added authentication route",
        status: "done",
      },
    ],
  };
}

describe("project outcome memory", () => {
  it("stores concise completed work when memory is enabled", async () => {
    const { client, memoryQuery } = makeClient({ enabled: true });

    await expect(
      persistProjectOutcome(client, "user-1", completedResult("Add auth")),
    ).resolves.toBe(true);
    expect(memoryQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "project",
        source: "auto",
        content: expect.stringContaining("Added authentication route"),
      }),
    );
  });

  it("does not persist if memory is disabled, settings fail, or the result is not complete", async () => {
    const disabled = makeClient({ enabled: false });
    const unavailable = makeClient({ enabled: true, settingsError: true });
    const partial = makeClient({ enabled: true });
    const partialResult = { ...completedResult("Add auth"), steps: [] };

    await expect(
      persistProjectOutcome(disabled.client, "user-1", completedResult("Add auth")),
    ).resolves.toBe(false);
    await expect(
      persistProjectOutcome(unavailable.client, "user-1", completedResult("Add auth")),
    ).resolves.toBe(false);
    await expect(persistProjectOutcome(partial.client, "user-1", partialResult)).resolves.toBe(
      false,
    );
    expect(disabled.memoryQuery.insert).not.toHaveBeenCalled();
    expect(unavailable.memoryQuery.insert).not.toHaveBeenCalled();
    expect(partial.memoryQuery.insert).not.toHaveBeenCalled();
  });

  it("does not remember read-only repository questions as project progress", async () => {
    const client = makeClient({ enabled: true });
    const readOnlyResult: AgentExecuteResult = {
      ...completedResult("Explain the project architecture"),
      steps: [
        {
          id: "step-1",
          tool: "repository.analyze",
          params: {},
          risk: "low",
          intent: "Analyze repository structure",
          status: "done",
        },
      ],
    };

    await expect(persistProjectOutcome(client.client, "user-1", readOnlyResult)).resolves.toBe(
      false,
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("avoids duplicate or sensitive project memories", async () => {
    const duplicate = makeClient({ enabled: true, duplicate: true });
    const secret = makeClient({ enabled: true });

    await expect(
      persistProjectOutcome(duplicate.client, "user-1", completedResult("Add auth")),
    ).resolves.toBe(false);
    await expect(
      persistProjectOutcome(secret.client, "user-1", completedResult("Store an API key")),
    ).resolves.toBe(false);
    expect(duplicate.memoryQuery.insert).not.toHaveBeenCalled();
    expect(secret.from).toHaveBeenCalledTimes(0);
  });
});
