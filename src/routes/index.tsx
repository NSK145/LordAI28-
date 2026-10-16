import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquare, GraduationCap, Target, Search, Brain, Calendar, Zap } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { EnergyOrb } from "@/components/lord/EnergyOrb";
import { MotionReveal } from "@/components/lord/MotionReveal";
import { useDashboard } from "@/hooks/use-dashboard";
import { LastSynced } from "@/components/lord/dashboard/shared";
import {
  LORDStatusPanel,
  AIStatusWidget,
  TasksWidget,
  CalendarWidget,
  MemoryWidget,
  ConversationsWidget,
  ResearchWidget,
  NotificationCenter,
} from "@/components/lord/dashboard/panels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LORD AI— Command Center" },
      {
        name: "description",
        content: "Intelligence Beyond Assistance. Your personal AI.",
      },
      { property: "og:title", content: "LORD AI" },
      { property: "og:description", content: "Intelligence Beyond Assistance." },
    ],
  }),
  component: Command,
});

const QUICK_ACTIONS = [
  { to: "/chat", label: "Chat", icon: MessageSquare, hint: "Talk to LORD" },
  { to: "/study", label: "Study", icon: GraduationCap, hint: "Learn faster" },
  { to: "/calendar", label: "Calendar", icon: Calendar, hint: "Your timeline" },
  { to: "/documents", label: "Research", icon: Search, hint: "Deep dive" },
  { to: "/productivity", label: "Tasks", icon: Target, hint: "Get it done" },
  { to: "/memory", label: "Memory", icon: Brain, hint: "Recall" },
] as const;

function Command() {
  const d = useDashboard();
  const reduceMotion = useReducedMotion();

  return (
    <AppShell>
      <section className="hero-core-panel relative mb-8 overflow-hidden rounded-2xl hud-panel p-5 sm:p-8 md:p-12">
        <div
          className="absolute inset-0 -z-0 opacity-30"
          style={{ background: "var(--gradient-radial)" }}
        />
        <div className="relative z-10 grid items-center gap-1 md:grid-cols-[minmax(0,1fr)_auto] md:gap-4">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-primary/80">
              <span
                className="status-pulse h-1.5 w-1.5 rounded-full bg-cyan-300"
                aria-hidden="true"
              />
              / system online
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl md:text-[4.4rem]">
              Intelligence, <span className="gradient-text text-glow">in motion.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              A considered space to think, create, and move your work forward.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/chat"
                className="premium-primary-button group relative inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Zap className="h-4 w-4" /> Start a conversation
              </Link>
              <a
                href="#workspace-modules"
                className="hero-secondary-button inline-flex min-h-12 items-center rounded-2xl px-5 text-sm font-medium text-foreground/80 hover:text-foreground"
              >
                Explore workspace
              </a>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span
                  className="status-pulse h-1.5 w-1.5 rounded-full bg-cyan-300"
                  aria-hidden="true"
                />
                LORD is ready
              </span>
              <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden="true" />
              <LastSynced at={d.lastSynced} />
            </div>
          </motion.div>
          <motion.div
            className="relative mx-auto -my-3 block md:my-0 md:-mr-2"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.8,
              delay: reduceMotion ? 0 : 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <EnergyOrb />
          </motion.div>
        </div>
      </section>

      <div
        id="workspace-modules"
        className="mb-8 grid scroll-mt-24 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6"
      >
        {QUICK_ACTIONS.map(({ to, label, icon: Icon, hint }, i) => (
          <motion.div
            key={to}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.32,
              delay: reduceMotion ? 0 : i * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Link
              to={to}
              className="quick-action-card group flex h-full min-h-28 flex-col items-start gap-3 rounded-xl border border-border/70 p-4 sm:p-5"
            >
              <span className="quick-action-icon grid h-10 w-10 place-items-center rounded-xl border border-primary/15 bg-primary/[0.07]">
                <Icon className="h-5 w-5 text-primary transition group-hover:scale-110" />
              </span>
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-sm font-medium tracking-wide">{label}</div>
                  <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    <span className="h-1 w-1 rounded-full bg-cyan-300/80" aria-hidden="true" />
                    Open
                  </span>
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MotionReveal>
          <LORDStatusPanel
            system={d.system}
            ai={d.ai}
            state={d.systemState}
            lastSynced={d.lastSynced}
          />
        </MotionReveal>
        <MotionReveal delay={0.04}>
          <AIStatusWidget data={d.ai} state={d.aiState} />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <TasksWidget data={d.tasks} state={d.tasksState} />
        </MotionReveal>
        <MotionReveal delay={0.04}>
          <CalendarWidget data={d.calendar} state={d.calendarState} />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <MemoryWidget data={d.memory} state={d.memoryState} />
        </MotionReveal>
        <MotionReveal delay={0.12}>
          <ResearchWidget data={d.research} state={d.researchState} />
        </MotionReveal>
        <MotionReveal delay={0.04}>
          <ConversationsWidget data={d.conversations} state={d.conversationsState} />
        </MotionReveal>
        <MotionReveal delay={0.08}>
          <NotificationCenter data={d.notifications} state={d.notificationsState} />
        </MotionReveal>

        <MotionReveal delay={0.12}>
          <HudPanel title="Directive" subtitle={`Mode: ${d.ai.activeMode}`}>
            <p className="text-sm text-muted-foreground">
              "<span className="text-foreground italic">Intelligence Beyond Assistance.</span>"
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: use <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd> in Chat
              to switch reasoning modes.
            </p>
          </HudPanel>
        </MotionReveal>
      </div>
    </AppShell>
  );
}
