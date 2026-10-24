import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MindGraphNodeList } from "./MindGraphNodeList";
import type { MindGraphNode } from "@/lib/memory/graph";

describe("Mind Graph mobile node list", () => {
  it("renders an accessible selectable alternative for graph nodes", () => {
    const node: MindGraphNode = {
      id: "memory:pref",
      label: "I prefer concise replies",
      description: "I prefer concise replies",
      kind: "memory",
      category: "preference",
      source: "manual",
      timestamp: "2026-10-24T00:00:00Z",
      confidence: 1,
      projectId: null,
      memory: {
        id: "pref",
        user_id: "owner",
        content: "I prefer concise replies",
        category: "preference",
        pinned: false,
        confidence: 1,
        source: "manual",
        embedding: null,
        created_at: "2026-10-24T00:00:00Z",
        updated_at: "2026-10-24T00:00:00Z",
        confirmation_status: "confirmed",
        use_in_context: true,
      },
    };
    const html = renderToStaticMarkup(
      createElement(MindGraphNodeList, {
        nodes: [node],
        selectedId: node.id,
        onSelect: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Mind Graph nodes"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("md:hidden");
    expect(html).toContain("I prefer concise replies");
  });
});
