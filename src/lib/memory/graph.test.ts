import { describe, expect, it } from "vitest";
import {
  arePossibleConflicts,
  arePossibleDuplicates,
  buildMindGraph,
  findMemoryIssues,
} from "./graph";
import type { MemoryRecord } from "./types";

function memory(id: string, content: string, category = "preference"): MemoryRecord {
  return {
    id,
    user_id: "owner",
    content,
    category: category as MemoryRecord["category"],
    pinned: false,
    confidence: 0.8,
    source: "auto",
    embedding: null,
    created_at: "2026-10-24T00:00:00Z",
    updated_at: "2026-10-24T00:00:00Z",
  };
}

describe("mind graph memory relationships", () => {
  it("detects likely duplicates and contradictory statements", () => {
    expect(arePossibleDuplicates("I prefer concise answers", "I prefer concise answers!")).toBe(
      true,
    );
    expect(arePossibleConflicts("I prefer concise answers", "I don't prefer concise answers")).toBe(
      true,
    );
    expect(arePossibleConflicts("I prefer concise answers", "I like hiking")).toBe(false);
  });

  it("links memory and task nodes to their project and each other", () => {
    const item = memory("1", "Build authentication for the app", "project");
    item.project_id = "project-1";
    const graph = buildMindGraph(
      [item],
      [{ id: "project-1", name: "LORD" }],
      [
        {
          id: "task-1",
          title: "Build authentication",
          status: "todo",
          priority: "high",
          created_at: "2026-10-24T00:00:00Z",
          project_id: "project-1",
        },
      ],
    );

    expect(graph.nodes.map(({ kind }) => kind)).toEqual(["project", "task", "memory"]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: "belongs to", from: "task:task-1" }),
        expect.objectContaining({ relation: "belongs to", from: "memory:1" }),
        expect.objectContaining({ relation: "related", from: "task:task-1", to: "memory:1" }),
      ]),
    );
  });

  it("surfaces duplicates and conflicts without merging or changing either memory", () => {
    const confirmed = memory("1", "I prefer concise responses");
    confirmed.confirmation_status = "confirmed";
    const suggested = memory("2", "I don't prefer concise responses");
    suggested.confirmation_status = "suggested";
    const issues = findMemoryIssues(suggested, [confirmed, suggested]);

    expect(issues.conflicts.map(({ id }) => id)).toEqual(["1"]);
    expect(issues.duplicates).toEqual([]);
    expect(suggested.confirmation_status).toBe("suggested");
  });

  it("connects conversation sources and styles verified outcomes and bug tasks distinctly", () => {
    const outcome = memory("outcome", "Project work completed: shipped the release", "project");
    outcome.confirmation_status = "confirmed";
    outcome.source_conversation_id = "conversation-1";
    const graph = buildMindGraph(
      [outcome],
      [{ id: "project-1", name: "LORD" }],
      [
        {
          id: "bug-1",
          title: "Bug: release fails on mobile",
          status: "todo",
          priority: "high",
          created_at: "2026-10-24T00:00:00Z",
          project_id: "project-1",
        },
      ],
      [
        {
          id: "conversation-1",
          title: "Release verification",
          created_at: "2026-10-24T00:00:00Z",
          project_id: "project-1",
        },
      ],
      [
        {
          id: "source-1",
          name: "Release notes",
          source_type: "document",
          created_at: "2026-10-24T00:00:00Z",
          project_id: "project-1",
        },
      ],
    );

    expect(graph.nodes.find(({ id }) => id === "memory:outcome")?.kind).toBe("outcome");
    expect(graph.nodes.find(({ id }) => id === "task:bug-1")?.category).toBe("bug");
    expect(graph.nodes.map(({ kind }) => kind)).toEqual([
      "project",
      "task",
      "conversation",
      "file",
      "outcome",
    ]);
    expect(graph.edges).toContainEqual({
      from: "memory:outcome",
      to: "conversation:conversation-1",
      relation: "source conversation",
    });
  });
});
