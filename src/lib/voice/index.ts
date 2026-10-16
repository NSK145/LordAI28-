import { WebSpeechWakeEngine } from "./webspeech-wake-engine";
import type { WakeEngine } from "./wake-engine";

export type { WakeEngine };
export { WebSpeechWakeEngine };

/** Uses exact browser speech recognition for “Hey, LORD”; no substitute model is used. */
export async function createWakeEngine(
  onWake: (phrase: string, command: string) => void,
  onInterim?: (transcript: string) => void,
  onError?: (message: string) => void,
  onInterrupted?: () => void,
): Promise<WakeEngine> {
  const engine = new WebSpeechWakeEngine();
  if (onInterim) engine.onInterim = onInterim;
  if (onError) engine.onError = onError;
  if (onInterrupted) engine.onInterrupted = onInterrupted;
  await engine.start(onWake);
  return engine;
}
