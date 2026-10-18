/** Keep a user's explicit choice first while retaining only distinct fallbacks. */
export function orderChatModelCandidates(
  requestedModelId: string | undefined,
  availableFallbackIds: readonly string[],
  limit = 3,
): string[] {
  const distinctFallbacks = [...new Set(availableFallbackIds)];
  if (!requestedModelId) return distinctFallbacks.slice(0, limit);
  return [
    requestedModelId,
    ...distinctFallbacks.filter((modelId) => modelId !== requestedModelId),
  ].slice(0, limit);
}
