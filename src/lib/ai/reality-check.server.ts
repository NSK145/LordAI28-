import "@tanstack/react-start/server-only";

const WINDOW_MS = 60_000;
const MAX_CHECKS_PER_USER = 4;
const requests = new Map<string, number[]>();

export function claimRealityCheckQuota(userId: string, now = Date.now()): boolean {
  const recent = (requests.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_CHECKS_PER_USER) {
    requests.set(userId, recent);
    return false;
  }
  recent.push(now);
  requests.set(userId, recent);
  if (requests.size > 5_000) {
    for (const [key, timestamps] of requests) {
      if (timestamps.every((at) => now - at >= WINDOW_MS)) requests.delete(key);
    }
  }
  return true;
}
