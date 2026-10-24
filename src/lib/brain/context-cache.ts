const contextCacheVersions = new Map<string, number>();

export function getBrainContextCacheVersion(userId: string): number {
  return contextCacheVersions.get(userId) ?? 0;
}

export function invalidateBrainContextCache(userId: string): void {
  contextCacheVersions.set(userId, getBrainContextCacheVersion(userId) + 1);
}
