import { describe, expect, it } from "vitest";
import { detectMemories } from "./detector";
import { retrieveMemories } from "./retrieval";
import { isMemoryActive, isMemoryEnabled, type MemoryRecord } from "./types";

describe("memory safety and extraction", () => {
  it("defaults memory on unless the user explicitly disables it", () => {
    expect(isMemoryEnabled(undefined)).toBe(true);
    expect(isMemoryEnabled({ memory_enabled: true })).toBe(true);
    expect(isMemoryEnabled({ memory_enabled: false })).toBe(false);
  });

  it("rejects expired memories and keeps non-expiring or future memories active", () => {
    const now = Date.parse("2026-09-27T12:00:00.000Z");

    expect(isMemoryActive(null, now)).toBe(true);
    expect(isMemoryActive("2026-09-27T12:01:00.000Z", now)).toBe(true);
    expect(isMemoryActive("2026-09-27T11:59:00.000Z", now)).toBe(false);
    expect(isMemoryActive("not-a-date", now)).toBe(false);
  });

  it("extracts durable preferences while ignoring greetings and credentials", () => {
    expect(detectMemories("I prefer TypeScript.")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "preference", confidence: expect.any(Number) }),
      ]),
    );
    expect(detectMemories("My name is Satwik.")).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "profile" })]),
    );
    expect(detectMemories("I'm building LORD.")).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "project" })]),
    );
    expect(detectMemories("Hello there!")).toEqual([]);
    expect(detectMemories("My API key is abc123secretvalue")).toEqual([]);
    expect(detectMemories("I prefer TypeScript. I prefer TypeScript.")).toHaveLength(1);
  });

  it("stores unfinished commitments as expiring project memories", () => {
    const [task] = detectMemories("We'll finish authentication tomorrow.");

    expect(task).toMatchObject({
      category: "project",
      confidence: 0.88,
      content: "We'll finish authentication tomorrow",
    });
    expect(Date.parse(task.expiresAt ?? "")).toBeGreaterThan(Date.now());
    expect(Date.parse(task.expiresAt ?? "")).toBeLessThanOrEqual(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
  });
});

describe("semantic retrieval", () => {
  it("ranks matching project memories and omits unrelated memories", async () => {
    const memory = (id: string, content: string): MemoryRecord => ({
      id,
      user_id: "user-1",
      content,
      category: "project",
      pinned: false,
      confidence: 0.9,
      source: "auto",
      embedding: null,
      created_at: "2026-09-27T12:00:00.000Z",
      updated_at: "2026-09-27T12:00:00.000Z",
    });

    const results = await retrieveMemories(
      "React JWT authentication",
      [
        memory("auth", "React project uses JWT authentication with a backend API"),
        memory("style", "The user prefers concise TypeScript examples"),
      ],
      { lightweight: true, minSimilarity: 0.1 },
    );

    expect(results.map(({ memory: item }) => item.id)).toEqual(["auth"]);
  });
});
