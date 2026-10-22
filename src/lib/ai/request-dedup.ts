/** Returns false when a message has already started an AI request in this UI session. */
export function claimRequestOnce(startedIds: Set<string>, messageId: string): boolean {
  if (startedIds.has(messageId)) return false;
  startedIds.add(messageId);
  return true;
}
