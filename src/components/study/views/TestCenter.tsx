import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileQuestion, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createExam, submitExamAnswer, completeExam, listExams } from "@/lib/learning/client";
import { StudyHeader } from "../StudyHeader";
import { DifficultyStars } from "../ui/DifficultyStars";
import { LoadingState } from "../ui/LoadingState";
import { EmptyState } from "../ui/EmptyState";
import type { LearningSnapshot, StudyView, Exam, ExamQuestion } from "../types";

interface TestCenterProps {
  snapshot: LearningSnapshot | undefined;
  userId: string | null;
  onNavigate: (view: StudyView) => void;
  onBack: () => void;
  refresh: () => void;
}

type TestStep = "lobby" | "creating" | "taking" | "results";

export function TestCenter({ snapshot, userId, onBack, refresh }: TestCenterProps) {
  const { user } = useCurrentUser();
  const [step, setStep] = useState<TestStep>("lobby");
  const [exams, setExams] = useState<Exam[]>([]);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<ExamQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [answersSubmitted, setAnswersSubmitted] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const submitLock = useRef(false);

  const [newExamInputs, setNewExamInputs] = useState({
    title: "",
    examType: "chapter",
    questionCount: 10,
    timeLimitMinutes: 30,
    difficulty: 3,
  });

  useEffect(() => {
    if (!user?.id || !snapshot) return;

    setLoading(true);
    void listExams(undefined, 10)
      .then((data) => {
        setExams(data?.exams ?? []);
        setLoading(false);
      })
      .catch(() => {
        setExams([]);
        setLoading(false);
      });
  }, [user?.id, snapshot]);

  const handleCreateExam = useCallback(async () => {
    if (!user?.id || !snapshot) return;

    // Exam question rows currently reference the shared curriculum concepts table.
    const conceptIds = (snapshot.concepts ?? [])
      .filter((concept) => !concept.is_custom)
      .slice(0, 5)
      .map((concept) => concept.id);
    if (conceptIds.length === 0) {
      setExamError("No curriculum concepts are available for an exam yet.");
      return;
    }

    setCreating(true);
    setExamError(null);
    try {
      const exam = await createExam(user.id, {
        examType: newExamInputs.examType as
          "mock" | "chapter" | "full_syllabus" | "custom" | "timed_quiz",
        conceptIds,
        questionCount: newExamInputs.questionCount,
        timeLimitMinutes: newExamInputs.timeLimitMinutes,
        difficulty: newExamInputs.difficulty,
      });

      setActiveExam(exam);
      setActiveQuestions((exam.questions ?? []) as ExamQuestion[]);
      setSelectedAnswers({});
      setAnswersSubmitted({});
      setCurrentQuestion(0);
      setTimeRemaining(exam.time_limit_seconds ?? newExamInputs.timeLimitMinutes * 60);
      setStep("taking");
    } catch (error) {
      setExamError(error instanceof Error ? error.message : "Could not create the exam. Please retry.");
    } finally {
      setCreating(false);
    }
  }, [user?.id, snapshot, newExamInputs]);

  const handleAnswerSelect = (questionId: string, index: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: index }));
  };

  const handleSubmitExam = useCallback(async () => {
    if (!activeExam || !user?.id || submitLock.current) return;

    submitLock.current = true;
    setSubmitting(true);
    setExamError(null);
    try {
      for (const q of activeQuestions) {
        const selectedIndex = selectedAnswers[q.id];
        if (selectedIndex !== undefined && answersSubmitted[q.id] === undefined) {
          await submitExamAnswer(activeExam.id, q.id, { selectedIndex }, 0);
          setAnswersSubmitted((prev) => ({ ...prev, [q.id]: selectedIndex }));
        }
      }

      await completeExam(activeExam.id);
      setStep("results");
      refresh();
    } catch (error) {
      setExamError(
        error instanceof Error
          ? `${error.message} Your answers are still available; retry submission when connected.`
          : "Answers could not be saved. Retry submission when connected.",
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [activeExam, user?.id, activeQuestions, selectedAnswers, answersSubmitted, refresh]);

  useEffect(() => {
    if (step !== "taking" || timeRemaining === null) return;

    if (timeRemaining <= 0) {
      void handleSubmitExam();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((t) => (t !== null ? t - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [step, timeRemaining, handleSubmitExam]);

  const getResults = () => {
    if (!activeQuestions.length) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    for (const q of activeQuestions) {
      const selected = selectedAnswers[q.id];
      if (selected !== undefined && selected === q.question.correctIndex) correct++;
    }
    return {
      correct,
      total: activeQuestions.length,
      percentage: Math.round((correct / activeQuestions.length) * 100),
    };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!snapshot || !user) {
    return (
      <div className="p-6">
        <StudyHeader
          view="exams"
          title="Test Center"
          onBack={onBack}
          showBack
          icon={<FileQuestion className="h-6 w-6 text-primary" />}
        />
      </div>
    );
  }

  const results = getResults();

  return (
    <div className="p-6">
      <StudyHeader
        view="exams"
        title="Test Center"
        subtitle="Generate and take adaptive exams"
        onBack={onBack}
        showBack
        icon={<FileQuestion className="h-6 w-6 text-primary" />}
      />

      {examError && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {examError}
        </p>
      )}

      <AnimatePresence mode="wait">
        {step === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl space-y-6"
          >
            {loading ? (
              <LoadingState message="Loading your exams…" />
            ) : exams.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  Your Exams
                </h3>
                {exams.map((exam) => (
                  <div key={exam.id} className="rounded-lg border border-border/40 bg-card/50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">{exam.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {exam.exam_type} · {exam.total_questions} questions
                        </p>
                        {exam.score !== null && (
                          <p className="mt-1 text-xs text-emerald-400">
                            Score: {Math.round(exam.score * 100)}%
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          exam.status === "completed"
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border border-border/30 bg-muted/20 text-muted-foreground",
                        )}
                      >
                        {exam.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FileQuestion className="h-8 w-8" />}
                title="No exams yet"
                description="Create your first adaptive exam below to test your knowledge."
              />
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="rounded-xl border border-border/40 bg-card/50 p-6"
            >
              <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
                Create New Exam
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                LORD will generate an adaptive {newExamInputs.examType} exam covering{" "}
                {(snapshot.concepts ?? []).slice(0, 5).length} concepts.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Exam Title</label>
                  <input
                    type="text"
                    value={newExamInputs.title}
                    onChange={(e) => setNewExamInputs({ ...newExamInputs, title: e.target.value })}
                    placeholder="e.g. Chapter 1 Review"
                    className="mt-1 w-full rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Exam Type</label>
                  <select
                    value={newExamInputs.examType}
                    onChange={(e) =>
                      setNewExamInputs({
                        ...newExamInputs,
                        examType: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  >
                    <option value="chapter">Chapter Test</option>
                    <option value="mock">Mock Exam</option>
                    <option value="full_syllabus">Full Syllabus</option>
                    <option value="timed_quiz">Timed Quiz</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Questions (5–50)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={newExamInputs.questionCount}
                    onChange={(e) =>
                      setNewExamInputs({
                        ...newExamInputs,
                        questionCount: parseInt(e.target.value) || 10,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                  <div className="mt-1">
                    <DifficultyStars difficulty={newExamInputs.difficulty} showLabel />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Time Limit (minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={newExamInputs.timeLimitMinutes}
                    onChange={(e) =>
                      setNewExamInputs({
                        ...newExamInputs,
                        timeLimitMinutes: parseInt(e.target.value) || 30,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateExam}
                disabled={creating || !newExamInputs.title.trim()}
                className={cn(
                  "mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold",
                  creating || !newExamInputs.title.trim()
                    ? "cursor-not-allowed bg-muted/30 text-muted-foreground"
                    : "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                )}
              >
                {creating ? "Generating…" : "Generate Exam"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {step === "taking" && activeExam && activeQuestions[currentQuestion] && (
          <motion.div
            key="taking"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl"
          >
            <div className="mb-4 flex items-center justify-between rounded-lg border border-border/30 bg-background/30 px-4 py-2.5">
              <span className="text-xs font-mono text-muted-foreground">
                Question {currentQuestion + 1} of {activeQuestions.length}
              </span>
              {timeRemaining !== null && (
                <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTime(timeRemaining)}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/40 bg-card/50 p-6">
              <div className="mb-2 flex items-center gap-2">
                <DifficultyStars
                  difficulty={activeQuestions[currentQuestion].difficulty}
                  size="sm"
                />
              </div>
              <h3 className="text-lg font-medium text-foreground">
                {activeQuestions[currentQuestion].question.prompt}
              </h3>

              <div className="mt-5 space-y-2">
                {activeQuestions[currentQuestion].question.choices.map(
                  (choice: string, index: number) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      onClick={() => handleAnswerSelect(activeQuestions[currentQuestion].id, index)}
                      className={cn(
                        "w-full rounded-lg border border-border/30 bg-background/40 p-3.5 text-left text-sm transition-all",
                        selectedAnswers[activeQuestions[currentQuestion].id] === index
                          ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(66,133,244,0.15)]"
                          : "hover:border-border/60 hover:bg-background/60",
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground/60">
                        {String.fromCharCode(65 + index)}
                      </span>{" "}
                      {choice}
                    </motion.button>
                  ),
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestion((i) => Math.max(0, i - 1))}
                disabled={currentQuestion === 0}
                className="rounded-lg border border-border/30 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-30"
              >
                Previous
              </button>
              <div className="flex gap-1.5">
                {activeQuestions.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-6 rounded-full",
                      selectedAnswers[activeQuestions[i].id] !== undefined
                        ? "bg-emerald-400"
                        : "bg-muted/30",
                    )}
                  />
                ))}
              </div>
              {currentQuestion < activeQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestion((i) => i + 1)}
                  className="rounded-lg border border-border/30 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Next
                </button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitExam}
                  disabled={submitting}
                  className="rounded-lg bg-primary/15 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/25"
                >
                  {submitting ? "Saving answers…" : "Submit Exam"}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {step === "results" && activeExam && activeQuestions.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl space-y-6"
          >
            <div className="rounded-xl border border-border/40 bg-card/50 p-6 text-center">
              <div className="mb-2 flex justify-center">
                {results.percentage >= 70 ? (
                  <CheckCircle className="h-12 w-12 text-emerald-400" />
                ) : (
                  <XCircle className="h-12 w-12 text-rose-400" />
                )}
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {results.percentage >= 70 ? "Passed" : "Needs Review"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You scored {results.correct} out of {results.total} ({results.percentage}%)
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                Review Your Answers
              </h3>
              {activeQuestions.map((q, i) => {
                const selected = selectedAnswers[q.id];
                const isCorrect = selected === q.question.correctIndex;
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-lg border p-4",
                      isCorrect
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted/30 px-1.5 py-0.5 font-mono">Q{i + 1}</span>
                      {isCorrect ? (
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-rose-400" />
                      )}
                      <DifficultyStars difficulty={q.difficulty} size="sm" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{q.question.prompt}</p>
                    {!isCorrect && (
                      <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                        <p className="text-xs text-emerald-400">
                          Correct answer: {q.question.choices[q.question.correctIndex]}
                        </p>
                      </div>
                    )}
                    {q.question.explanation && (
                      <p className="mt-2 text-xs text-muted-foreground">{q.question.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setStep("lobby");
                  setActiveExam(null);
                  setActiveQuestions([]);
                  refresh();
                }}
                className="rounded-lg border border-border/30 bg-background/40 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/20"
              >
                Back to Test Center
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
