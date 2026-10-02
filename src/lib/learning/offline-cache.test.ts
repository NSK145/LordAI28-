import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLearningSnapshotOffline,
  loadLearningSnapshotOffline,
  saveLearningSnapshotOffline,
} from "./offline-cache";

function storageStub() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("study offline cache", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores and retrieves user-scoped study snapshots", () => {
    vi.stubGlobal("localStorage", storageStub());
    const snapshot = { concepts: [], mastery: [] } as never;
    saveLearningSnapshotOffline("user-a", snapshot);
    expect(loadLearningSnapshotOffline("user-a")?.snapshot).toEqual(snapshot);
    expect(loadLearningSnapshotOffline("user-b")).toBeNull();
  });

  it("clears a user's cached study snapshot", () => {
    vi.stubGlobal("localStorage", storageStub());
    saveLearningSnapshotOffline("user-a", { concepts: [] } as never);
    clearLearningSnapshotOffline("user-a");
    expect(loadLearningSnapshotOffline("user-a")).toBeNull();
  });
});
