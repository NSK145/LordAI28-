import { describe, expect, it } from "vitest";
import { sortRootConversations } from "./conversation-grouping";

describe("sortRootConversations pin ordering", () => {
  it("keeps pinned chats above unpinned chats while preserving existing unpinned order", () => {
    const rows = [
      { id: "newer", title: "Newer", last_message_at: "2026-10-22T12:00:00Z" },
      {
        id: "pinned-old",
        title: "Pinned old",
        last_message_at: "2026-10-01T12:00:00Z",
        pinned: true,
        pinned_at: "2026-10-21T12:00:00Z",
      },
      { id: "older", title: "Older", last_message_at: "2026-10-20T12:00:00Z" },
      {
        id: "pinned-new",
        title: "Pinned new",
        last_message_at: "2026-10-02T12:00:00Z",
        pinned: true,
        pinned_at: "2026-10-22T12:00:00Z",
      },
    ];

    expect(sortRootConversations(rows).map((row) => row.id)).toEqual([
      "pinned-new",
      "pinned-old",
      "newer",
      "older",
    ]);
  });

  it("keeps manually ordered unpinned chats in their existing order", () => {
    const rows = [
      { id: "second", title: "Second", last_message_at: "2026-10-22T12:00:00Z", sort_order: 1 },
      { id: "first", title: "First", last_message_at: "2026-10-20T12:00:00Z", sort_order: 0 },
      {
        id: "pinned",
        title: "Pinned",
        last_message_at: "2026-10-01T12:00:00Z",
        pinned: true,
        pinned_at: "2026-10-22T12:00:00Z",
        sort_order: 2,
      },
    ];

    expect(sortRootConversations(rows).map((row) => row.id)).toEqual(["pinned", "first", "second"]);
  });
});
