import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { recordFocusSession } from "@/lib/learning/focus-sessions";

export function StudyFocusSession({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const deadlineRef = useRef(0);
  const savedCompletionRef = useRef(false);
  const timeLabel = useMemo(
    () =>
      `${Math.floor(remaining / 60)
        .toString()
        .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`,
    [remaining],
  );

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      requestAnimationFrame(() => dialogRef.current?.focus());
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        setCompleted(true);
        if (!savedCompletionRef.current) {
          savedCompletionRef.current = true;
          recordFocusSession(userId, minutes);
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, userId, minutes]);

  const start = () => {
    deadlineRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const pause = () => {
    setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setCompleted(false);
    savedCompletionRef.current = false;
    setRemaining(minutes * 60);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/60 px-3 text-sm text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open focus session timer"
      >
        <Timer className="h-4 w-4" /> Focus
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }
              if (event.key === "Tab") {
                const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), select:not([disabled])",
                );
                if (!controls?.length) return;
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
            className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="focus-title" className="text-lg font-semibold">
                Focus session
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                aria-label="Close focus timer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a study block. Your completed sessions are saved on this device.
            </p>
            {!running && !completed && (
              <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Session length">
                {[15, 25, 50].map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={minutes === option}
                    onClick={() => {
                      setMinutes(option);
                      setRemaining(option * 60);
                      savedCompletionRef.current = false;
                    }}
                    className={`min-h-10 rounded-lg border px-3 text-sm ${minutes === option ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                  >
                    {option} min
                  </button>
                ))}
              </div>
            )}
            <div className="py-7 text-center">
              <div
                role="timer"
                aria-live="off"
                aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
                className="font-mono text-6xl font-semibold tabular-nums"
              >
                {timeLabel}
              </div>
              <p aria-live="polite" className="mt-2 min-h-5 text-sm text-muted-foreground">
                {completed
                  ? "Session complete. Take a short break."
                  : running
                    ? "Stay focused. You can pause any time."
                    : "Ready when you are."}
              </p>
            </div>
            {completed ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  <Check className="h-4 w-4" /> Start another
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-lg border border-border px-4 text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {running ? (
                  <button
                    type="button"
                    onClick={pause}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    <Pause className="h-4 w-4" /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={start}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    <Play className="h-4 w-4" />{" "}
                    {remaining === minutes * 60 ? "Start focus" : "Resume"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm"
                  aria-label="Reset focus timer"
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
