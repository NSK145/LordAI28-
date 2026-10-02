import type { LearningSnapshot } from "./types";

const CACHE_VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface CachedSnapshot {
  version: number;
  savedAt: number;
  snapshot: LearningSnapshot;
}

function cacheKey(userId: string) {
  return `lord-study-cache-v${CACHE_VERSION}:${userId}`;
}

export function saveLearningSnapshotOffline(userId: string, snapshot: LearningSnapshot): void {
  if (typeof localStorage === "undefined") return;
  try {
    const payload: CachedSnapshot = { version: CACHE_VERSION, savedAt: Date.now(), snapshot };
    localStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch {
    // Browsers may deny storage or run out of space. Keep online study working.
  }
}

export function loadLearningSnapshotOffline(userId: string): CachedSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSnapshot;
    if (cached.version !== CACHE_VERSION || !cached.snapshot || !Number.isFinite(cached.savedAt))
      return null;
    if (Date.now() - cached.savedAt > MAX_AGE_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

export function clearLearningSnapshotOffline(userId: string): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(cacheKey(userId));
}
