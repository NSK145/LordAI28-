import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/dashboard-service";

export function PulseOnChange({
  value,
  children,
  className,
}: {
  value: unknown;
  children: ReactNode;
  className?: string;
}) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 900);
      return () => clearTimeout(id);
    }
  }, [value]);
  return <div className={cn(pulse && "dashboard-pulse", className)}>{children}</div>;
}

export function LastSynced({ at }: { at: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!at) {
    return <span className="text-[10px] text-muted-foreground">Syncing…</span>;
  }
  const rel = relativeTime(at);
  const label = rel === "just now" ? "Synced just now" : `Synced ${rel}`;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--hud-success)] animate-blink" />
      {label}
    </span>
  );
}

export function WidgetError() {
  return (
    <div className="flex flex-col items-center gap-1 py-5 text-center">
      <p className="text-xs text-muted-foreground">Unable to load data.</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Retrying…</p>
    </div>
  );
}

export function Metric({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--hud-success)]"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-destructive"
          : "text-primary";
  return (
    <div className="metric-card rounded-2xl p-4">
      <div className={cn("font-display text-3xl text-glow", toneClass)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--hud-success)]"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="metric-card rounded-xl p-3">
      <div className="flex items-center justify-center text-primary">{icon}</div>
      <div className={cn("mt-1 font-display text-sm", toneClass)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-9 rounded-xl" />
      ))}
    </div>
  );
}
