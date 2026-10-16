/**
 * Wake-engine interface.
 *
 * Engines run independently of speech-to-text. When the wake word fires,
 * `onWake` is invoked; the caller then opens a short STT window to capture
 * the user's command.
 */
export interface WakeEngine {
  readonly name: string;
  /** Load models / request mic. Resolves once ready to detect. */
  start(onWake: (phrase: string, command: string) => void): Promise<void>;
  /** Release mic + workers. Safe to call multiple times. */
  stop(): Promise<void>;
  /** Pause detection (e.g., while LORD is speaking) without releasing mic. */
  pause(): void;
  resume(): void;
}
