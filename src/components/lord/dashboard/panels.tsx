import { Link } from "@tanstack/react-router";
import {
  Cpu,
  Activity,
  Clock,
  CircleCheck,
  CircleDot,
  AlertTriangle,
  ListTodo,
  CalendarDays,
  Brain,
  FlaskConical,
  Boxes,
  Wifi,
  WifiOff,
  Bell,
  Pin,
  Archive,
  MessagesSquare,
  Timer,
  Gauge,
} from "lucide-react";
import { HudPanel } from "@/components/lord/HudPanel";
import { PulseOnChange, LastSynced, WidgetError, Metric, Stat, SkeletonRows } from "./shared";
import { cn } from "@/lib/utils";
import { type SliceState } from "@/hooks/use-dashboard";
import { relativeTime } from "@/lib/dashboard-service";
import type {
  DashboardSystem,
  DashboardAI,
  DashboardConversations,
  DashboardTasks,
  DashboardCalendar,
  DashboardMemory,
  DashboardResearch,
  DashboardNotifications,
} from "@/lib/dashboard-service";

interface PanelProps<T> {
  data: T;
  state: SliceState;
}

function engineTone(engine: DashboardSystem["engine"]): "success" | "warning" | "danger" {
  if (engine === "online") return "success";
  if (engine === "offline") return "danger";
  return "warning";
}

function latencyTone(ms: number | null): "success" | "warning" | "danger" {
  if (ms == null) return "danger";
  if (ms < 200) return "success";
  if (ms < 500) return "warning";
  return "danger";
}

export function LORDStatusPanel({
  system,
  ai,
  state,
  lastSynced,
}: {
  system: DashboardSystem;
  ai: DashboardAI;
  state: SliceState;
  lastSynced: number;
}) {
  if (state.isError) {
    return (
      <HudPanel title="LORD Status" subtitle="Core systems">
        <WidgetError />
      </HudPanel>
    );
  }
  if (state.isLoading) {
    return (
      <HudPanel title="LORD Status" subtitle="Core systems">
        <SkeletonRows rows={3} />
      </HudPanel>
    );
  }
  return (
    <HudPanel title="LORD Status" subtitle="Core systems" action={<LastSynced at={lastSynced} />}>
      <PulseOnChange value={`${system.engine}-${system.latencyMs}-${system.uptimeLabel}`}>
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
          <Stat
            icon={<Cpu className="h-4 w-4" />}
            label="Engine"
            value={
              system.engine === "online"
                ? "Online"
                : system.engine === "offline"
                  ? "Offline"
                  : system.engine === "initializing"
                    ? "Initializing"
                    : "Maintenance"
            }
            tone={engineTone(system.engine)}
          />
          <Stat
            icon={<Activity className="h-4 w-4" />}
            label="Latency"
            value={system.latencyMs != null ? `${system.latencyMs} ms` : "—"}
            tone={latencyTone(system.latencyMs)}
          />
          <Stat icon={<Clock className="h-4 w-4" />} label="Uptime" value={system.uptimeLabel} />
        </div>
      </PulseOnChange>
      <div className="mt-4 rounded-md border border-border/60 bg-background/40 p-3 text-xs font-mono text-muted-foreground">
        <div>&gt; model pool:</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {ai.models.length === 0 ? (
            <span className="text-muted-foreground">probing providers…</span>
          ) : (
            ai.models.map((m) => (
              <span
                key={m.id}
                className={cn(
                  "inline-flex items-center gap-1",
                  m.available ? "text-primary" : "text-muted-foreground/40 line-through",
                )}
              >
                {m.available ? "✓" : "○"} {m.label}
              </span>
            ))
          )}
        </div>
        <div className="mt-1 text-[var(--hud-success)]">&gt; monitoring_</div>
      </div>
    </HudPanel>
  );
}

export function TasksWidget({ data, state }: PanelProps<DashboardTasks>) {
  if (state.isError)
    return (
      <HudPanel title="Operations" subtitle="Tasks & goals">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="Operations" subtitle="Tasks & goals">
        <SkeletonRows rows={2} />
      </HudPanel>
    );
  return (
    <HudPanel title="Operations" subtitle="Tasks & goals">
      <PulseOnChange value={`${data.pending}-${data.completed}-${data.overdue}-${data.dueToday}`}>
        <div className="grid grid-cols-2 gap-3">
          <Metric
            value={data.pending}
            label="Pending"
            tone={data.pending > 0 ? "warning" : undefined}
          />
          <Metric value={data.completed} label="Completed" tone="success" />
          <Metric
            value={data.overdue}
            label="Overdue"
            tone={data.overdue > 0 ? "danger" : undefined}
          />
          <Metric
            value={data.dueToday}
            label="Due Today"
            tone={data.dueToday > 0 ? "warning" : undefined}
          />
        </div>
      </PulseOnChange>
      <Link to="/productivity" className="mt-3 inline-block text-xs text-primary hover:underline">
        Open Productivity Center →
      </Link>
    </HudPanel>
  );
}

export function CalendarWidget({ data, state }: PanelProps<DashboardCalendar>) {
  if (state.isError)
    return (
      <HudPanel title="Schedule" subtitle="Calendar">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="Schedule" subtitle="Calendar">
        <SkeletonRows rows={3} />
      </HudPanel>
    );
  const hasToday = data.todays.length > 0;
  const hasTomorrow = data.tomorrow.length > 0;
  const hasUpcoming = data.upcoming.length > 0;
  return (
    <HudPanel title="Schedule" subtitle="Calendar">
      <PulseOnChange
        value={`${data.todays.length}-${data.tomorrow.length}-${data.upcoming.length}-${data.daysRemaining}`}
      >
        {!data.hasEvents ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {hasToday && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
                  <CalendarDays className="h-3 w-3" /> Today
                </div>
                <ul className="space-y-1">
                  {data.todays.map((e) => (
                    <li key={e.id} className="truncate text-muted-foreground">
                      {e.startTime ? `${e.startTime} · ` : ""}
                      {e.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasTomorrow && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Tomorrow
                </div>
                <ul className="space-y-1">
                  {data.tomorrow.map((e) => (
                    <li key={e.id} className="truncate text-muted-foreground">
                      {e.startTime ? `${e.startTime} · ` : ""}
                      {e.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasUpcoming && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Upcoming deadlines
                </div>
                <ul className="space-y-1">
                  {data.upcoming.slice(0, 3).map((e) => (
                    <li key={e.id} className="truncate text-muted-foreground">
                      {e.title} · {new Date(e.date).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
              {data.nextReminder && (
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3 w-3 text-primary" /> Next reminder soon
                </span>
              )}
              {data.daysRemaining != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> {data.daysRemaining}{" "}
                  {data.daysRemaining === 1 ? "day" : "days"} remaining
                </span>
              )}
            </div>
          </div>
        )}
      </PulseOnChange>
      <Link to="/calendar" className="mt-3 inline-block text-xs text-primary hover:underline">
        Open Calendar →
      </Link>
    </HudPanel>
  );
}

export function MemoryWidget({ data, state }: PanelProps<DashboardMemory>) {
  if (state.isError)
    return (
      <HudPanel title="Memory Activity" subtitle="Long-term recall">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="Memory Activity" subtitle="Long-term recall">
        <SkeletonRows rows={3} />
      </HudPanel>
    );
  return (
    <HudPanel
      title="Memory Activity"
      subtitle="Long-term recall"
      action={
        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
          {data.source}
        </span>
      }
    >
      <PulseOnChange
        value={`${data.stored}-${data.important}-${data.recentlyLearned}-${data.lastUpdated}`}
      >
        <div className="grid grid-cols-3 gap-2">
          <Metric value={data.stored} label="Stored" />
          <Metric value={data.important} label="Important" tone="success" />
          <Metric value={data.recentlyLearned} label="New (24h)" />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Memory usage</span>
            <span>{data.usagePct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${data.usagePct}%`, boxShadow: "0 0 8px var(--hud)" }}
            />
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Last updated: {relativeTime(data.lastUpdated)}
          </div>
        </div>
      </PulseOnChange>
      <Link to="/memory" className="mt-3 inline-block text-xs text-primary hover:underline">
        Open Memory Vault →
      </Link>
    </HudPanel>
  );
}

export function ConversationsWidget({ data, state }: PanelProps<DashboardConversations>) {
  if (state.isError)
    return (
      <HudPanel title="Recent Conversations" subtitle="Chat history">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="Recent Conversations" subtitle="Chat history">
        <SkeletonRows rows={4} />
      </HudPanel>
    );
  return (
    <HudPanel title="Recent Conversations" subtitle="Chat history" className="md:col-span-2">
      <PulseOnChange value={`${data.total}-${data.lastActivity}`}>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data.requiresAuth ? (
              <>
                Sign in to view your conversations.{" "}
                <Link to="/auth" className="text-primary hover:underline">
                  Sign in →
                </Link>
              </>
            ) : (
              <>
                No conversations yet.{" "}
                <Link to="/chat" className="text-primary hover:underline">
                  Start one →
                </Link>
              </>
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {data.items.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-sm">
                    {c.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                    {c.archived && <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{c.title}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.preview}</div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(c.lastActivity)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PulseOnChange>
      <Link to="/chat" className="mt-3 inline-block text-xs text-primary hover:underline">
        Open Chat →
      </Link>
    </HudPanel>
  );
}

export function ResearchWidget({ data, state }: PanelProps<DashboardResearch>) {
  if (state.isError)
    return (
      <HudPanel title="Research" subtitle="Deep dives">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="Research" subtitle="Deep dives">
        <SkeletonRows rows={3} />
      </HudPanel>
    );
  return (
    <HudPanel title="Research" subtitle="Deep dives">
      <PulseOnChange value={`${data.current}-${data.completed}-${data.savedDocuments}`}>
        <div className="grid grid-cols-3 gap-2">
          <Metric
            value={data.current}
            label="Running"
            tone={data.current > 0 ? "warning" : undefined}
          />
          <Metric value={data.completed} label="Completed" tone="success" />
          <Metric value={data.savedDocuments} label="Docs" />
        </div>
        {data.sessions.length > 0 && (
          <ul className="mt-3 space-y-1">
            {data.sessions.slice(0, 3).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/30 px-3 py-1.5 text-xs"
              >
                <span className="truncate">{s.title}</span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                    s.status === "running"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PulseOnChange>
      <Link to="/documents" className="mt-3 inline-block text-xs text-primary hover:underline">
        Open Research →
      </Link>
    </HudPanel>
  );
}

const AI_HEALTH: Record<DashboardAI["health"], { dot: string; label: string }> = {
  healthy: { dot: "bg-[var(--hud-success)]", label: "Healthy" },
  degraded: { dot: "bg-amber-400", label: "Degraded" },
  offline: { dot: "bg-destructive", label: "Offline" },
};

export function AIStatusWidget({ data, state }: PanelProps<DashboardAI>) {
  if (state.isError)
    return (
      <HudPanel title="AI Status" subtitle="Model health">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="AI Status" subtitle="Model health">
        <SkeletonRows rows={4} />
      </HudPanel>
    );
  const health = AI_HEALTH[data.health];
  const providerLabel: Record<DashboardAI["providerStatus"], string> = {
    available: "Connected",
    missing_credentials: "Not configured",
    invalid_credentials: "Credentials rejected",
    rate_limited: "Rate limit reached",
    timeout: "Connection timed out",
    unavailable: "Provider unavailable",
  };
  return (
    <HudPanel title="AI Status" subtitle="Model health">
      <PulseOnChange
        value={`${data.health}-${data.openRouterAvailable}-${data.failedRequests}-${data.lastSuccessfulRequest}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", health.dot)} />
            <span className="text-sm font-medium">{health.label}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {data.openRouterAvailable ? (
              <Wifi className="h-3.5 w-3.5 text-[var(--hud-success)]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            {providerLabel[data.providerStatus]}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border/60 bg-background/40 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Active model
            </div>
            <div className="mt-0.5 truncate text-foreground">{data.activeModel ?? "—"}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mode</div>
            <div className="mt-0.5 capitalize text-foreground">{data.activeMode}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Last success
            </div>
            <div className="mt-0.5 text-foreground">{relativeTime(data.lastSuccessfulRequest)}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-background/40 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Failed / Rate
            </div>
            <div
              className={cn(
                "mt-0.5",
                data.failedRequests > 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {data.failedRequests} {data.rateLimited ? "· limited" : ""}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Boxes className="h-3 w-3" /> Provider model list verified against OpenRouter.
        </div>
      </PulseOnChange>
    </HudPanel>
  );
}

export function NotificationCenter({ data, state }: PanelProps<DashboardNotifications>) {
  if (state.isError)
    return (
      <HudPanel title="Notification Center" subtitle="Live events">
        <WidgetError />
      </HudPanel>
    );
  if (state.isLoading)
    return (
      <HudPanel title="Notification Center" subtitle="Live events">
        <SkeletonRows rows={4} />
      </HudPanel>
    );
  return (
    <HudPanel
      title="Notification Center"
      subtitle="Live events"
      action={
        data.unread > 0 ? (
          <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] text-destructive">
            {data.unread} new
          </span>
        ) : null
      }
    >
      <PulseOnChange value={data.items.map((i) => i.id).join(",")}>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {data.items.slice(0, 8).map((n) => (
              <li key={n.id} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    n.severity === "error"
                      ? "bg-destructive"
                      : n.severity === "warning"
                        ? "bg-amber-400"
                        : n.severity === "success"
                          ? "bg-[var(--hud-success)]"
                          : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-muted-foreground">{n.message}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {n.type} · {relativeTime(n.timestamp)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PulseOnChange>
    </HudPanel>
  );
}
