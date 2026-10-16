import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Target, Brain, Bookmark, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MasteryBadge } from "../ui/MasteryBadge";
import { StudyHeader } from "../StudyHeader";
import { addConceptToPlan } from "@/lib/learning/client";
import type { LearningSnapshot, StudyView, LearningConcept } from "../types";

interface ConceptDetailProps {
  snapshot: LearningSnapshot | undefined;
  userId: string | null;
  conceptId?: string;
  onNavigate: (view: StudyView) => void;
  onStartInContext?: (view: StudyView) => void;
  onBack: () => void;
  refresh: () => void;
}

export function ConceptDetail({
  snapshot,
  userId,
  conceptId,
  onNavigate,
  onStartInContext,
  onBack,
  refresh,
}: ConceptDetailProps) {
  const [adding, setAdding] = useState(false);

  if (!snapshot || !conceptId) {
    return (
      <div className="p-6">
        <StudyHeader
          view="concepts"
          title="Concept Not Found"
          onBack={onBack}
          showBack
          icon={<GraduationCap className="h-6 w-6 text-primary" />}
        />
      </div>
    );
  }

  // Compute overall mastery stats for header
  const { concepts, mastery, resources, sources } = snapshot;
  const masteredCount = mastery.filter((m) => m.score >= 0.8).length;
  const totalConcepts = concepts.length;
  const overallMasteryPercent =
    totalConcepts > 0 ? Math.round((masteredCount / totalConcepts) * 100) : 0;
  const planTaskConceptIds = snapshot.tasks
    .filter((t) => t.concept_id)
    .map((t) => t.concept_id as string);

  const masteryMap = new Map(mastery.map((m) => [m.concept_id, m]));

  const concept = concepts.find((c) => c.id === conceptId);
  const conceptMastery = masteryMap.get(conceptId);

  const alreadyInPlan = planTaskConceptIds.includes(conceptId);

  if (!concept) {
    return (
      <div className="p-6">
        <StudyHeader
          view="concepts"
          title="Concept Not Found"
          subtitle="The requested concept could not be found."
          onBack={onBack}
          showBack
          icon={<GraduationCap className="h-6 w-6 text-primary" />}
        />
      </div>
    );
  }

  const score = conceptMastery?.score ?? 0.35;
  const mastered = score >= 0.8;
  const inProgress = score >= 0.55;
  const completedTasks = conceptMastery?.evidence_count ?? 0;
  const nextReview = conceptMastery?.next_review_at;

  const relatedResources = resources.filter((r) => r.concept_id === conceptId);
  const relatedSources = sources.filter(
    (s) => s.extracted_text && concept.keywords?.some((kw) => s.extracted_text?.includes(kw)),
  );

  const handleAddToPlan = async () => {
    if (!userId || alreadyInPlan || adding) return;
    setAdding(true);
    try {
      await addConceptToPlan(userId, { id: concept.id, title: concept.title });
      toast.success(`${concept.title} added to your study plan.`);
      refresh();
    } catch {
      toast.error("Could not add concept to your study plan.");
    } finally {
      setAdding(false);
    }
  };

  const actionButtons = [
    {
      label: "Start Practice",
      icon: <Target className="h-4 w-4" />,
      onClick: () => (onStartInContext ? onStartInContext("practice") : onNavigate("practice")),
      variant: "primary" as const,
    },
    {
      label: "Ask LORD Tutor",
      icon: <GraduationCap className="h-4 w-4" />,
      onClick: () => (onStartInContext ? onStartInContext("tutor") : onNavigate("tutor")),
      variant: "secondary" as const,
    },
    {
      label: "Flashcards",
      icon: <Brain className="h-4 w-4" />,
      onClick: () => (onStartInContext ? onStartInContext("flashcards") : onNavigate("flashcards")),
      variant: "secondary" as const,
    },
    {
      label: alreadyInPlan ? "Added to Plan" : "Add to Plan",
      icon: adding ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : alreadyInPlan ? (
        <Check className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      ),
      onClick: handleAddToPlan,
      variant: alreadyInPlan ? ("added" as const) : ("secondary" as const),
      disabled: alreadyInPlan || adding,
    },
  ];

  return (
    <div className="p-6">
      <StudyHeader
        view="concepts"
        title={concept.title}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {concept.standard_code}
            {concept.is_custom && (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.25 text-xs font-medium text-amber-400">
                Custom concept
              </span>
            )}
            {snapshot?.profile?.class && (
              <span className="text-xs text-muted-foreground">
                · Class {snapshot.profile.class}
              </span>
            )}
          </span>
        }
        icon={<GraduationCap className="h-6 w-6 text-primary" />}
        onBack={onBack}
        showBack
        action={<MasteryBadge score={score} showLabel />}
        masteryPercent={overallMasteryPercent}
        totalConcepts={totalConcepts}
        masteredCount={masteredCount}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-xl border border-border/40 bg-card/50 p-6"
          >
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {concept.description || "No description available for this concept."}
            </p>

            {concept.learning_objectives && concept.learning_objectives.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Learning Objectives
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {concept.learning_objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="rounded-xl border border-border/40 bg-card/50 p-6"
          >
            <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {actionButtons.map((btn, i) => (
                <motion.button
                  key={btn.label}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.25 + i * 0.05 }}
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
                    btn.disabled && "cursor-not-allowed opacity-70",
                    btn.variant === "primary"
                      ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                      : btn.variant === "added"
                        ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-400"
                        : "border border-border/40 bg-muted/20 text-foreground hover:bg-muted/30",
                  )}
                >
                  {btn.icon}
                  {btn.label}
                </motion.button>
              ))}
            </div>
          </motion.section>

          {concept.misconception_tags && concept.misconception_tags.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 }}
              className="rounded-xl border border-border/40 bg-card/50 p-6"
            >
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
                Common Misconceptions
              </h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {concept.misconception_tags.map((tag, i) => (
                  <li key={i}>{tag}</li>
                ))}
              </ul>
            </motion.section>
          )}
        </div>

        <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-xl border border-border/40 bg-card/50 p-5"
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mastery Details
            </h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Current level</span>
                  <span className="font-medium text-foreground">{Math.round(score * 100)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Evidence count</span>
                <span className="font-medium text-foreground">{completedTasks}</span>
              </div>

              {nextReview && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Next review</span>
                  <span className="font-medium text-foreground">
                    {new Date(nextReview).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </motion.section>

          {relatedResources.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="rounded-xl border border-border/40 bg-card/50 p-5"
            >
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Related Resources
              </h3>
              <div className="space-y-2">
                {relatedResources.map((resource) => (
                  <div key={resource.id} className="group">
                    <a
                      href={resource.url ?? undefined}
                      className={cn(
                        "block text-sm font-medium text-foreground transition-colors",
                        resource.url ? "hover:text-primary" : "cursor-default",
                      )}
                    >
                      {resource.title}
                    </a>
                    <p className="text-xs text-muted-foreground/70">
                      {resource.provenance} · {resource.resource_type}
                    </p>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {concept.chapter && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="rounded-xl border border-border/40 bg-card/50 p-4 text-center"
            >
              <p className="text-xs text-muted-foreground">Chapter</p>
              <p className="font-medium text-foreground">{concept.chapter}</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
