import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MessageSquare,
  Type,
  Coins,
  Clock,
  Gauge,
  CalendarDays,
  TrendingUp,
  DollarSign,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { useConversationStats } from "@/hooks/use-conversation-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/statistics")({
  head: () => ({ meta: [{ title: "LORD — Conversation Statistics" }] }),
  component: StatisticsPage,
});

/* ------------------------------------------------------------------ */
/* Animated counter (framer-motion tween)                              */
/* ------------------------------------------------------------------ */

function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return (
    <span>
      {display.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatResponseTime(ms: number): string {
  if (ms <= 0) return "—";
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/* Glass card                                                          */
/* ------------------------------------------------------------------ */

function GlassCard({
  className,
  children,
  glow,
}: {
  className?: string;
  children: React.ReactNode;
  glow?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/50 p-5",
        "bg-[rgba(10,16,30,0.55)] backdrop-blur-2xl",
        glow && "shadow-[0_0_30px_rgba(66,133,244,0.18)]",
        className,
      )}
      style={{
        borderColor: "rgba(66,133,244,0.18)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* neon top edge */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(66,133,244,0.7), transparent)",
        }}
      />
      {children}
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <GlassCard className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={{ color: accent ?? "var(--hud)" }} />
        {label}
      </div>
      <div
        className="font-display text-3xl font-semibold text-glow"
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function StatisticsPage() {
  const { isLoading, isError, aggregate, dayActivity, perConversation } = useConversationStats();

  const chartData = dayActivity.map((d) => ({
    label: d.label,
    Prompts: d.prompts,
    Replies: d.replies,
  }));

  const topConversations = [...perConversation]
    .sort((a, b) => b.totalMessages - a.totalMessages)
    .slice(0, 6);

  if (isError) {
    return (
      <AppShell>
        <div className="glass-panel rounded-2xl p-8 text-center text-muted-foreground">
          Unable to load conversation statistics.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl">
            Conversation Statistics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate analytics across every conversation · computed locally.
          </p>
        </div>
        {isLoading && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-ping rounded-full bg-[var(--hud-success)]" />
            Computing…
          </span>
        )}
      </div>

      {/* Stat panel */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icon={MessageSquare}
          label="Messages"
          value={<AnimatedCounter value={aggregate.totalMessages} />}
          sub={`${aggregate.totalPrompts} prompts · ${aggregate.totalAiReplies} replies`}
        />
        <StatCard
          icon={Type}
          label="Words"
          value={<AnimatedCounter value={aggregate.totalWords} />}
          sub={`${aggregate.totalTokens.toLocaleString()} est. tokens`}
        />
        <StatCard
          icon={Coins}
          label="Tokens"
          value={<AnimatedCounter value={aggregate.totalTokens} />}
          sub={`${formatCost(aggregate.totalCost)} est. cost`}
        />
        <StatCard
          icon={Clock}
          label="Time Spent"
          value={formatDuration(aggregate.totalDurationMs)}
          sub={`${aggregate.totalConversations} conversations`}
        />
        <StatCard
          icon={Gauge}
          label="Avg Response"
          value={formatResponseTime(aggregate.avgResponseTimeMs)}
          sub="user → AI reply"
          accent="var(--hud-success)"
        />
        <StatCard
          icon={DollarSign}
          label="Estimated Cost"
          value={formatCost(aggregate.totalCost)}
          sub={`${aggregate.totalTokens.toLocaleString()} tokens`}
          accent="var(--hud-warn)"
        />
      </div>

      {/* Activity graph + most active day */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <GlassCard className="flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium uppercase tracking-wider text-foreground/90">
              Activity Graph
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
              prompts vs replies
            </span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No activity yet. Start a conversation to populate the graph.
            </div>
          ) : chartData.length <= 14 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,16,30,0.92)",
                    border: "1px solid rgba(66,133,244,0.3)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9aa0a6" }}
                />
                <Bar dataKey="Prompts" stackId="a" fill="#4285f4" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Replies" stackId="a" fill="#5a95ff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPrompts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4285f4" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#4285f4" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradReplies" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5a95ff" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#5a95ff" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,16,30,0.92)",
                    border: "1px solid rgba(66,133,244,0.3)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9aa0a6" }}
                />
                <Area
                  type="monotone"
                  dataKey="Prompts"
                  stroke="#4285f4"
                  fill="url(#gradPrompts)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Replies"
                  stroke="#5a95ff"
                  fill="url(#gradReplies)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        <GlassCard glow className="flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium uppercase tracking-wider text-foreground/90">
              Most Active Day
            </span>
          </div>
          {aggregate.mostActiveDay ? (
            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="font-display text-4xl font-bold text-glow gradient-text">
                {aggregate.mostActiveDay.label}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {aggregate.mostActiveDay.count.toLocaleString()}
                </span>{" "}
                messages on this day — your peak activity.
              </div>
              {aggregate.firstActivity && aggregate.lastActivity && (
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border/40 bg-background/20 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      First activity
                    </div>
                    <div className="mt-1">
                      {new Date(aggregate.firstActivity).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-background/20 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Last activity
                    </div>
                    <div className="mt-1">
                      {new Date(aggregate.lastActivity).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No activity recorded yet.
            </div>
          )}
        </GlassCard>
      </div>

      {/* Per-conversation leaderboard */}
      <div className="mt-4">
        <GlassCard>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium uppercase tracking-wider text-foreground/90">
              Top Conversations
            </span>
          </div>
          {topConversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <div className="space-y-2">
              {topConversations.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/20 px-3 py-2"
                >
                  <span className="w-6 shrink-0 text-center font-display text-sm text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground/90">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.totalMessages} msgs · {c.totalWords.toLocaleString()} words ·{" "}
                      {formatResponseTime(c.avgResponseTimeMs)} avg
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCost(c.estimatedCost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}
