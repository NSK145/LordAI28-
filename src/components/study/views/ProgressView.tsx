import { useEffect, useState } from "react";
import React from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  CheckCircle,
  XCircle,
  BookOpen,
  TrendingUp,
  Award,
  Flame,
  Target,
  Brain,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { StudyHeader } from "../StudyHeader";
import { MasteryBadge } from "../ui/MasteryBadge";
import { DifficultyStars } from "../ui/DifficultyStars";
import { StatCard } from "../ui/StatCard";
import { EmptyState } from "../ui/EmptyState";
import { LearningJourney } from "../ui/LearningJourney";
import { getLearnerStats } from "@/lib/learning/gamification";
import { buildLearningJourney } from "@/lib/learning/journey";
import { getFocusRecords, type FocusRecord } from "@/lib/learning/focus-sessions";
import type { LearningSnapshot, StudyView } from "../types";

interface ProgressViewProps {
  snapshot: LearningSnapshot | undefined;
  userId: string | null;
  onNavigate: (view: StudyView) => void;
  onBack: () => void;
  refresh: () => void;
}

export function ProgressView({ snapshot, userId, onNavigate, onBack, refresh }: ProgressViewProps) {
  const [focusRecords, setFocusRecords] = useState<FocusRecord[]>(() =>
    userId ? getFocusRecords(userId) : [],
  );
  useEffect(() => {
    if (!userId) return;
    setFocusRecords(getFocusRecords(userId));
    const update = (event: Event) => {
      if ((event as CustomEvent<{ userId?: string }>).detail?.userId === userId) {
        setFocusRecords(getFocusRecords(userId));
      }
    };
    window.addEventListener("lord:focus-session-complete", update);
    return () => window.removeEventListener("lord:focus-session-complete", update);
  }, [userId]);
  if (!snapshot || !userId) {
    return (
      <div className="p-6">
        <StudyHeader
          view="progress"
          title="Progress"
          onBack={onBack}
          showBack
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
        />
      </div>
    );
  }

  const { concepts, mastery, attempts, sessions, analytics } = snapshot;
  const masteryMap = new Map(mastery.map((m) => [m.concept_id, m]));

  const masteredCount = mastery.filter((m) => m.score >= 0.8).length;
  const learningCount = mastery.filter((m) => m.score >= 0.6 && m.score < 0.8).length;
  const introducedCount = mastery.filter((m) => m.score >= 0.35 && m.score < 0.6).length;
  const notStartedCount = concepts.length - mastery.length;

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.correct).length;
  const avgScore = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  const totalStudyTime = analytics?.reduce((sum, a) => sum + (a.study_time_seconds ?? 0), 0) ?? 0;
  const focusMinutes = focusRecords.reduce((sum, item) => sum + item.minutes, 0);
  const totalStudyMinutes = Math.floor(totalStudyTime / 60) + focusMinutes;

  let streak = 0;
  const cursor = new Date();
  const activeDays = new Set([
    ...[...sessions, ...attempts].map((item) => new Date(item.created_at).toDateString()),
    ...focusRecords.map((item) => new Date(item.completedAt).toDateString()),
  ]);
  while (activeDays.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const subjectStats = new Map<string, { count: number; avgScore: number }>();
  concepts.forEach((c) => {
    const m = masteryMap.get(c.id);
    const subject = c.subject ?? "General";
    const existing = subjectStats.get(subject) ?? { count: 0, avgScore: 0 };
    existing.count += 1;
    existing.avgScore += m?.score ?? 0;
    subjectStats.set(subject, existing);
  });

  const subjectList = Array.from(subjectStats.entries())
    .map(([subject, stats]) => ({
      subject,
      count: stats.count,
      avgMastery: stats.count > 0 ? Math.round((stats.avgScore / stats.count) * 100) : 0,
    }))
    .sort((a, b) => b.avgMastery - a.avgMastery);

  const learnerStats = getLearnerStats({
    attempts,
    sessions,
    history: snapshot.history ?? [],
    flashcards: (snapshot.flashcards ?? []).map((f) => ({ reviews: [] })),
    exams: snapshot.exams ?? [],
    mastery,
    analytics: snapshot.analytics ?? [],
    daily_goals: snapshot.daily_goals ?? [],
  });

  const journey = buildLearningJourney(
    concepts,
    mastery,
    snapshot.history ?? [],
    sessions,
    attempts,
  );

  const recentAttempts = attempts
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);

  return (
    <div className="p-6">
      <StudyHeader
        view="progress"
        title="Learning Progress"
        subtitle="Your mastery and performance analytics"
        onBack={onBack}
        showBack
        icon={<BarChart3 className="h-6 w-6 text-primary" />}
      />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Mastery Level"
          value={`${masteredCount}/${mastery.length}`}
          detail={`${masteredCount} concepts mastered`}
          accent="emerald"
          delay={0}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Accuracy"
          value={`${avgScore}%`}
          detail={`${correctAttempts}/${totalAttempts} attempts correct`}
          accent="cyan"
          delay={1}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Study Time"
          value={`${totalStudyMinutes}m`}
          detail="Total time learning"
          accent="violet"
          delay={2}
        />
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="Streak"
          value={`${streak}d`}
          detail="Consecutive active days"
          accent="amber"
          delay={3}
        />
      </motion.section>

      {learnerStats && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8"
        >
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            Learning Profile
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
              <div className="text-3xl font-bold text-primary">Lvl {learnerStats.level}</div>
              <div className="text-xs text-muted-foreground mt-1">Level</div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.round((learnerStats.xp / learnerStats.xpToNextLevel) * 100)}%`,
                  }}
                  transition={{ duration: 0.6 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {learnerStats.xp} / {learnerStats.xpToNextLevel} XP
              </div>
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-center">
              <div className="text-3xl font-bold text-orange-500">{learnerStats.streak}</div>
              <div className="text-xs text-muted-foreground mt-1">Day Streak</div>
              <div className="text-xs text-orange-400 mt-1">
                Best: {learnerStats.longestStreak}d
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <div className="text-3xl font-bold text-emerald-500">
                {learnerStats.achievements.filter((a) => a.unlockedAt).length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Achievements</div>
              <div className="text-xs text-emerald-400 mt-1">
                {learnerStats.achievements.length} total
              </div>
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-center">
              <div className="text-3xl font-bold text-violet-500">{learnerStats.totalXp}</div>
              <div className="text-xs text-muted-foreground mt-1">Total XP</div>
              <div className="text-xs text-violet-400 mt-1">
                {learnerStats.recentXp.length} recent activities
              </div>
            </div>
          </div>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-8"
      >
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          Learning Journey
        </h3>
        <LearningJourney
          events={journey.events}
          stats={learnerStats}
          snapshot={snapshot}
          onConceptClick={(id) => onNavigate("concepts")}
        />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-8"
      >
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
          Mastery Overview
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MasteryStatCard
            label="Mastered"
            count={masteredCount}
            color="emerald"
            icon={<CheckCircle className="h-4 w-4" />}
            delay={0}
          />
          <MasteryStatCard
            label="Learning"
            count={learningCount}
            color="amber"
            icon={<TrendingUp className="h-4 w-4" />}
            delay={1}
          />
          <MasteryStatCard
            label="Introduced"
            count={introducedCount}
            color="slate"
            icon={<BookOpen className="h-4 w-4" />}
            delay={2}
          />
          <MasteryStatCard
            label="Not Started"
            count={notStartedCount}
            color="muted"
            icon={<XCircle className="h-4 w-4" />}
            delay={3}
          />
        </div>
      </motion.section>

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            Performance by Subject
          </h3>
          <div className="space-y-3">
            {subjectList.map((item, i) => (
              <div key={item.subject} className="rounded-lg border border-border/30 bg-card/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{item.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.count} concept{item.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.avgMastery}%` }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Avg mastery: {item.avgMastery}%
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            Recent Activity
          </h3>
          {recentAttempts.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-8 w-8" />}
              title="No recent activity"
              description="Start practicing to build your learning history."
            />
          ) : (
            <div className="space-y-2">
              {recentAttempts.map((attempt) => {
                const concept = concepts.find((c) => c.id === attempt.concept_id);
                return (
                  <div
                    key={attempt.id}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/40 px-3 py-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/40">
                      {attempt.correct ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {concept?.title ?? attempt.concept_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.created_at).toLocaleDateString()} · Score:{" "}
                        {attempt.score ?? "N/A"}
                      </p>
                    </div>
                    <MasteryBadge score={masteryMap.get(attempt.concept_id)?.score} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {subjectList.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mb-8"
          >
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              Subject Radar
            </h3>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart
                  data={subjectList.map((s) => ({ subject: s.subject, mastery: s.avgMastery }))}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" className="text-xs" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} className="text-xs" />
                  <Radar
                    name="Mastery %"
                    dataKey="mastery"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}

        {(snapshot.analytics ?? []).length > 1 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="mb-8"
          >
            <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
              Study Consistency
            </h3>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={(snapshot.analytics ?? []).slice(0, 14).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="study_time_seconds"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Study Time (s)"
                  />
                  <Line
                    type="monotone"
                    dataKey="questions_answered"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Questions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}

function MasteryStatCard({
  label,
  count,
  color,
  icon,
  delay,
}: {
  label: string;
  count: number;
  color: "emerald" | "amber" | "slate" | "muted";
  icon: React.ReactNode;
  delay: number;
}) {
  const colorClasses: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    slate: "border-slate-500/30 bg-slate-500/5",
    muted: "border-border/30 bg-card/40",
  };

  const iconColors: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    slate: "text-slate-400",
    muted: "text-muted-foreground",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay * 0.1 }}
      className={cn("rounded-xl border p-4 text-center", colorClasses[color])}
    >
      <div className={cn("mb-1 flex justify-center", iconColors[color])}>{icon}</div>
      <div className="text-3xl font-bold text-foreground">{count}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
}
