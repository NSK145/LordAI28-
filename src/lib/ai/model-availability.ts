/**
 * Small process-local health cache for free model routing. Failures temporarily
 * cool down a model; a later request probes it again after the cooldown. The
 * cache is deliberately advisory: if every candidate is cooling down we still
 * try the configured free chain so a healthy provider can recover immediately.
 */

export interface ModelAttemptResult {
  readonly success: boolean;
  readonly status?: number;
}

interface ModelHealthEntry {
  failures: number;
  successes: number;
  cooldownUntil: number;
  lastAttemptAt: number;
}

const modelHealth = new Map<string, ModelHealthEntry>();
const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 5 * 60_000;

export function recordModelAttempt(
  modelId: string,
  result: ModelAttemptResult,
  now = Date.now(),
): void {
  const entry = modelHealth.get(modelId) ?? {
    failures: 0,
    successes: 0,
    cooldownUntil: 0,
    lastAttemptAt: 0,
  };
  entry.lastAttemptAt = now;

  if (result.success) {
    entry.successes += 1;
    entry.failures = 0;
    entry.cooldownUntil = 0;
  } else {
    entry.failures += 1;
    const duration =
      result.status === 429
        ? Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** (entry.failures - 1))
        : result.status && result.status >= 400 && result.status < 500
          ? MAX_COOLDOWN_MS
          : BASE_COOLDOWN_MS;
    entry.cooldownUntil = now + duration;
  }
  modelHealth.set(modelId, entry);
}

export function isModelAvailable(modelId: string, now = Date.now()): boolean {
  const entry = modelHealth.get(modelId);
  if (!entry) return true;
  if (entry.cooldownUntil <= now) {
    entry.cooldownUntil = 0;
    return true;
  }
  return false;
}

export function preferAvailableModels<T extends { modelId: string }>(
  candidates: readonly T[],
): T[] {
  const available = candidates.filter((candidate) => isModelAvailable(candidate.modelId));
  return available.length > 0 ? available : [...candidates];
}

/** Test helper; does not expose runtime diagnostics to the client. */
export function clearModelAvailabilityForTests(): void {
  modelHealth.clear();
}
