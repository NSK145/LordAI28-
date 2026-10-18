import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Target, Play, Pause, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { usePersistedState } from "@/lib/use-persisted-state";
import { uid, type Goal } from "@/lib/lord-store";

export const Route = createFileRoute("/_authenticated/productivity")({
  head: () => ({ meta: [{ title: "LORD — Productivity" }] }),
  component: ProductivityPage,
});

function ProductivityPage() {
  const [goals, setGoals] = usePersistedState<Goal[]>("goals", []);
  const [goalInput, setGoalInput] = useState("");

  const addGoal = () => {
    if (!goalInput.trim()) return;
    setGoals([
      { id: uid(), title: goalInput.trim(), progress: 0, createdAt: Date.now() },
      ...goals,
    ]);
    setGoalInput("");
  };
  const updateGoal = (id: string, progress: number) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, progress } : g)));
  const removeGoal = (id: string) => setGoals(goals.filter((g) => g.id !== id));

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl">
        Productivity Center
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Tasks, goals, and focus — orchestrated.</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <HudPanel title="Tasks" subtitle="Priorities, schedules, and reminders">
          <p className="mb-4 text-sm text-muted-foreground">
            Manage your tasks and due-date notifications in the unified task center.
          </p>
          <Link
            to="/tasks"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Target className="h-4 w-4" /> Open Tasks & Notifications
          </Link>
        </HudPanel>

        {/* Pomodoro */}
        <Pomodoro />

        {/* Goals */}
        <HudPanel title="Long-term Goals" className="lg:col-span-3">
          <div className="mb-3 grid gap-2 sm:flex">
            <input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGoal()}
              placeholder="New goal…"
              className="min-h-11 flex-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-base outline-none focus:border-primary sm:text-sm"
            />
            <button
              onClick={addGoal}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Target className="h-4 w-4" /> Add Goal
            </button>
          </div>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goals yet.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {goals.map((g) => (
                <li key={g.id} className="rounded-md border border-border/40 bg-background/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{g.title}</span>
                    <button
                      onClick={() => removeGoal(g.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={g.progress}
                    onChange={(e) => updateGoal(g.id, +e.target.value)}
                    className="mt-2 w-full accent-[var(--hud)]"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="text-primary text-glow">{g.progress}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HudPanel>
      </div>
    </AppShell>
  );
}

function Pomodoro() {
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          const next = mode === "focus" ? "break" : "focus";
          setMode(next);
          return next === "focus" ? 25 * 60 : 5 * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const total = mode === "focus" ? 25 * 60 : 5 * 60;
  const pct = ((total - seconds) / total) * 100;

  return (
    <HudPanel title="Pomodoro" subtitle={mode === "focus" ? "Focus block" : "Break"}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="3" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--hud)"
              strokeWidth="3"
              strokeDasharray={`${pct * 2.76} 999`}
              style={{ filter: "drop-shadow(0 0 6px var(--hud))" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-display text-4xl text-glow text-primary">
            {mm}:{ss}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)]"
          >
            {running ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Start
              </>
            )}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              setSeconds(mode === "focus" ? 25 * 60 : 5 * 60);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>
    </HudPanel>
  );
}
