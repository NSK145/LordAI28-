import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOfflineConversations,
  getOfflineMessages,
  saveOfflineConversations,
  saveOfflineMessages,
} from "./chat-offline-cache";

function localStorageStub() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("chat offline cache", () => {
  it("stores recent conversations and messages separately per account", () => {
    vi.stubGlobal("localStorage", localStorageStub());
    const conversations = [{ id: "conversation-1", title: "Study" }];
    const messages = [
      { id: "message-1", role: "user", content: "hello", created_at: "2026-10-02" },
    ];

    saveOfflineConversations("user-a", conversations);
    saveOfflineMessages("user-a", "conversation-1", messages);

    expect(getOfflineConversations("user-a")).toEqual(conversations);
    expect(getOfflineMessages("user-a", "conversation-1")).toEqual(messages);
    expect(getOfflineConversations("user-b")).toEqual([]);
    expect(getOfflineMessages("user-b", "conversation-1")).toEqual([]);
  });

  it("limits cached conversation history to a bounded recent window", () => {
    vi.stubGlobal("localStorage", localStorageStub());
    const messages = Array.from({ length: 40 }, (_, index) => ({
      id: `message-${index}`,
      role: "user",
      content: `message ${index}`,
      created_at: new Date(index).toISOString(),
    }));

    saveOfflineMessages("user-a", "conversation-1", messages);

    const saved = getOfflineMessages("user-a", "conversation-1");
    expect(saved).toHaveLength(30);
    expect(saved[0].id).toBe("message-10");
    expect(saved.at(-1)?.id).toBe("message-39");
  });
});
