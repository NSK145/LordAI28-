export function canAccessWhatIfScenario(
  scenarioOwnerId: string,
  authenticatedUserId: string,
): boolean {
  return scenarioOwnerId === authenticatedUserId;
}
