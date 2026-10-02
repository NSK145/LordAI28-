import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Lightbulb, Check, X, Clock, SkipForward, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { recordAttempt } from "@/lib/learning/client";
import { selectNextConcept } from "@/lib/learning/mastery";
import { callLearningSession } from "../lib/session-api";
import { StudyHeader } from "../StudyHeader";
import { MasteryBadge } from "../ui/MasteryBadge";
import { DifficultyStars } from "../ui/DifficultyStars";
import { LoadingState } from "../ui/LoadingState";
import { EmptyState } from "../ui/EmptyState";
import type { LearningSnapshot, StudyView, Question } from "../types";

interface PracticeViewProps {
  snapshot: LearningSnapshot | undefined;
  userId: string | null;
  conceptId?: string;
  onNavigate: (view: StudyView) => void;
  onBack: () => void;
  refresh: () => void;
}

type PracticeStep = "select" | "question" | "answering" | "feedback";

export function PracticeView({ snapshot, userId, conceptId, onBack, refresh }: PracticeViewProps) {
  const { user } = useCurrentUser();
  const [step, setStep] = useState<PracticeStep>("select");
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === "question" && startTime > 0) {
      interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, startTime]);

  const fetchQuestion = useCallback(async () => {
    if (!user?.id) return;
    const concept =
      conceptId || selectNextConcept(snapshot?.concepts ?? [], snapshot?.mastery ?? [])?.id;
    if (!concept) return;

    setLoading(true);
    setStep("question");
    setQuestion(null);
    setSelectedAnswer(null);
    setCorrect(null);
    setHint("");
    setShowHint(false);
    setShowExplanation(false);

    try {
      const res = await callLearningSession({
        action: "question",
        conceptId: concept,
        difficulty: Math.max(
          1,
          Math.min(
            5,
            Math.round(
              (snapshot?.mastery.find((item) => item.concept_id === concept)?.score ?? 0.35) * 4,
            ) + 1,
          ),
        ),
      });

      const q = (res as { question: Question })?.question;
      if (q) {
        setQuestion(q);
        setStep("question");
      }
    } catch {
      setStep("select");
    } finally {
      setLoading(false);
      setStartTime(Date.now());
      setTimeElapsed(0);
    }
  }, [user?.id, conceptId, snapshot]);

  if (!snapshot || !user) {
    return (
      <div className="p-6">
        <StudyHeader
          view="practice"
          title="Adaptive Practice"
          subtitle="AI-generated questions for your concepts"
          onBack={onBack}
          showBack
          icon={<Target className="h-6 w-6 text-primary" />}
        />
      </div>
    );
  }

  const handleStartPractice = () => {
    const concept =
      conceptId || selectNextConcept(snapshot.concepts ?? [], snapshot.mastery ?? [])?.id;
    if (!concept) return;
    void fetchQuestion();
  };

  const handleSelectAnswer = (index: number) => {
    if (step !== "question" || loading) return;
    setSelectedAnswer(index);
  };

  const handleSubmit = async () => {
    if (!question || selectedAnswer === null || !user?.id) return;

    setLoading(true);
    const isCorrect = selectedAnswer === question.correctIndex;
    setCorrect(isCorrect);
    setShowExplanation(true);
    setStep("feedback");

    try {
      await recordAttempt(user.id, question, selectedAnswer);
      refresh();
    } catch {
      // Silently handle — mastery will still update on next refresh
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setCorrect(null);
    setShowExplanation(false);
    setShowHint(false);
    setHint("");
    void fetchQuestion();
  };

  const handleRevealAnswer = () => {
    setShowExplanation(true);
  };

  const handleShowHint = () => {
    setShowHint(true);
  };

  const getSelectedConcept = () => {
    const id = conceptId || selectNextConcept(snapshot.concepts ?? [], snapshot.mastery ?? [])?.id;
    return id ? (snapshot.concepts ?? []).find((c) => c.id === id) : undefined;
  };

  const getMasteryForConcept = () => {
    const id = conceptId || selectNextConcept(snapshot.concepts ?? [], snapshot.mastery ?? [])?.id;
    return id ? snapshot.mastery.find((m) => m.concept_id === id) : undefined;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const selectedConcept = getSelectedConcept();
  const selectedMastery = getMasteryForConcept();

  return (
    <div className="p-6">
      <StudyHeader
        view="practice"
        title="Adaptive Practice"
        subtitle={selectedConcept?.title ?? "AI-generated questions"}
        onBack={onBack}
        showBack
        icon={<Target className="h-6 w-6 text-primary" />}
        action={selectedMastery && <MasteryBadge score={selectedMastery.score} showLabel />}
      />

      <AnimatePresence mode="wait">
        {step === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl"
          >
            <div className="rounded-xl border border-border/40 bg-card/50 p-6">
              <h2 className="font-display text-xl font-semibold text-foreground">
                Adaptive Practice
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                LORD will generate a question tailored to your current mastery level. Each correct
                answer raises your mastery score; incorrect answers trigger a review at the optimal
                interval.
              </p>

              {selectedConcept ? (
                <div className="mt-4 rounded-lg border border-border/30 bg-background/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{selectedConcept.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConcept.standard_code} ·{" "}
                        <DifficultyStars difficulty={selectedConcept.difficulty ?? 3} size="sm" />
                      </p>
                    </div>
                    <MasteryBadge score={selectedMastery?.score} showLabel />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No concepts available"
                  description="You need concepts in your learning path to practice."
                  className="py-6"
                />
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartPractice}
                disabled={!selectedConcept}
                className={cn(
                  "mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold",
                  selectedConcept
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    : "cursor-not-allowed bg-muted/30 text-muted-foreground",
                )}
              >
                <Play className="h-4 w-4" />
                Start Practice
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === "question" && (
          <motion.div
            key="question"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {loading ? (
              <LoadingState message="Generating your adaptive question…" />
            ) : question ? (
              <div className="max-w-3xl">
                <div className="mb-4 flex items-center justify-between rounded-lg border border-border/30 bg-background/30 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatTime(timeElapsed)}
                    </span>
                  </div>
                  {selectedConcept && (
                    <DifficultyStars difficulty={question.difficulty} size="sm" showLabel />
                  )}
                </div>

                <div className="rounded-xl border border-border/40 bg-card/50 p-6">
                  <h2 className="text-lg font-medium text-foreground">{question.prompt}</h2>

                  {question.hint && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <Lightbulb className="mt-0.5 h-4 w-4 text-amber-400" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-amber-300">Hint:</span> {question.hint}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 space-y-2">
                    {question.choices.map((choice, index) => (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        onClick={() => handleSelectAnswer(index)}
                        disabled={loading}
                        className={cn(
                          "w-full rounded-lg border border-border/30 bg-background/40 p-3.5 text-left text-sm transition-all",
                          selectedAnswer === index
                            ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(66,133,244,0.15)]"
                            : "hover:border-border/60 hover:bg-background/60",
                        )}
                      >
                        <span className="font-mono text-xs text-muted-foreground/60">
                          {String.fromCharCode(65 + index)}
                        </span>{" "}
                        {choice}
                      </motion.button>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <button
                      onClick={handleShowHint}
                      disabled={showHint}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors",
                        showHint && "cursor-default opacity-50",
                      )}
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      Show Hint
                    </button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      disabled={selectedAnswer === null || loading}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                        selectedAnswer !== null
                          ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                          : "cursor-not-allowed bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {loading ? "Checking…" : "Submit"}
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No question generated"
                description="Could not generate a question. Try again."
                action={
                  <button
                    onClick={() => setStep("select")}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Back
                  </button>
                }
              />
            )}
          </motion.div>
        )}

        {step === "feedback" && question && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl"
          >
            <div
              className={cn(
                "rounded-xl border p-6",
                correct
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-rose-500/30 bg-rose-500/5",
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                {correct ? (
                  <>
                    <Check className="h-5 w-5 text-emerald-400" />
                    <span className="font-semibold text-emerald-400">Correct!</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-rose-400" />
                    <span className="font-semibold text-rose-400">Not quite right</span>
                  </>
                )}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {question.explanation}
              </p>

              {showExplanation && (
                <div className="mt-4 rounded-lg border border-border/30 bg-background/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Answer
                  </p>
                  <p className="text-sm text-foreground">
                    {question.choices[question.correctIndex]}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{formatTime(timeElapsed)}</span> · Solved
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNextQuestion}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                <SkipForward className="h-4 w-4" />
                Next Question
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
