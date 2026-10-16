import { useState, useEffect } from "react";
import { BookOpen, ChevronRight, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LearningConcept } from "@/lib/learning/types";
import { createStudyPlan, deleteStudyPlan, generateAIPlan } from "@/lib/study-plans";

interface CreatePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  concepts: LearningConcept[];
  onCreated: (planId: string) => void;
  onBrowseConcepts: () => void;
}

export function CreatePlanModal({
  open,
  onOpenChange,
  userId,
  concepts,
  onCreated,
  onBrowseConcepts,
}: CreatePlanModalProps) {
  const [mode, setMode] = useState<"choose" | "manual" | "ai">("choose");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [examDate, setExamDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setTitle("");
      setDescription("");
      setStartDate(new Date().toISOString().slice(0, 10));
      setTargetDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
      setDailyMinutes(120);
      setSelectedConcepts([]);
      setPreferredDays([1, 2, 3, 4, 5]);
      setDifficulty("medium");
      setExamDate("");
      setError(null);
    }
  }, [open]);

  const handleCreateManual = async () => {
    if (!userId || !title.trim()) return;
    const validationError = validatePlan(false);
    if (validationError) {
      setError(validationError);
      return;
    }
    setCreating(true);
    setError(null);
    let planId: string | null = null;
    try {
      const plan = await createStudyPlan({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        targetDate,
        dailyMinutes,
        subjects: selectedConcepts.length > 0 ? ["custom"] : undefined,
        preferredDays,
        difficulty,
        examDate: examDate || undefined,
        source: "manual",
        conceptIds: selectedConcepts,
      });
      planId = plan.id;
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "The study plan could not be saved.",
      );
      setCreating(false);
      return;
    }
    try {
      if (planId) await onCreated(planId);
      onOpenChange(false);
    } catch {
      setError(
        "Your plan was saved, but the planner could not refresh. Close this dialog or retry the page to see it.",
      );
    }
    setCreating(false);
  };

  const handleCreateAI = async () => {
    if (!userId || !title.trim()) return;
    const validationError = validatePlan(true);
    if (validationError) {
      setError(validationError);
      return;
    }
    setCreating(true);
    setError(null);
    let planId: string | null = null;
    try {
      const plan = await createStudyPlan({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        targetDate,
        dailyMinutes,
        subjects: ["custom"],
        preferredDays,
        difficulty,
        examDate: examDate || undefined,
        source: "ai",
        conceptIds: selectedConcepts,
      });
      planId = plan.id;
      await generateAIPlan(plan.id, {
        conceptIds: selectedConcepts,
        weeklyMinutes: Math.min(1680, Math.max(30, dailyMinutes * 7)),
        examDate: examDate || undefined,
        planName: title.trim(),
        startDate,
        targetDate,
        dailyMinutes,
        difficulty,
        goal: description.trim() || title.trim(),
        preferredDays,
      });
    } catch (createError) {
      let cleanupFailed = false;
      if (planId) {
        try {
          await deleteStudyPlan(planId);
        } catch {
          cleanupFailed = true;
        }
      }
      setError(
        `${createError instanceof Error ? createError.message : "LORD could not create the plan."}${cleanupFailed ? " The empty plan could not be removed; refresh the planner and delete it before retrying." : ""}`,
      );
      setCreating(false);
      return;
    }

    if (planId) {
      try {
        await onCreated(planId);
        onOpenChange(false);
      } catch {
        setError(
          "Your plan was generated, but the planner could not refresh. Close this dialog or retry the page to see it.",
        );
      }
    }
    setCreating(false);
  };

  const toggleConcept = (id: string) => {
    setSelectedConcepts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const toggleDay = (day: number) => {
    setPreferredDays((prev) => {
      if (prev.includes(day)) return prev.length === 1 ? prev : prev.filter((d) => d !== day);
      return [...prev, day].sort();
    });
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const validatePlan = (requiresConcept: boolean) => {
    if (!Number.isInteger(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 480) {
      return "Daily study time must be between 5 and 480 minutes.";
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))
    ) {
      return "Choose a valid start date.";
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) ||
      Number.isNaN(Date.parse(`${targetDate}T00:00:00Z`))
    ) {
      return "Choose a valid target date.";
    }
    if (targetDate < startDate) return "The target date must be on or after the start date.";
    if (examDate && examDate < startDate)
      return "The exam date must be on or after the start date.";
    if (requiresConcept && selectedConcepts.length === 0) {
      return "Choose at least one concept for LORD to plan.";
    }
    return null;
  };

  if (mode === "choose") {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !creating && onOpenChange(nextOpen)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create Study Plan</DialogTitle>
            <DialogDescription>How would you like to create your plan?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <button
              onClick={() => setMode("manual")}
              className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Create manually</p>
                <p className="text-xs text-muted-foreground">
                  Set up your own schedule and add tasks
                </p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setMode("ai")}
              className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ask LORD to create it</p>
                <p className="text-xs text-muted-foreground">
                  AI generates an optimized plan for you
                </p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !creating && onOpenChange(nextOpen)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85dvh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "manual" ? "Create Study Plan" : "Ask LORD to Create Plan"}
          </DialogTitle>
          <DialogDescription>
            {mode === "manual"
              ? "Set up your study schedule and customize it your way."
              : "LORD will generate an optimized plan based on your preferences."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="plan-title">Plan name</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Final Exam Prep"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="plan-desc">Goal / description</Label>
            <Textarea
              id="plan-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you trying to achieve?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="plan-start">Start date</Label>
              <Input
                id="plan-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  setStartDate(nextStart);
                  if (targetDate < nextStart) setTargetDate(nextStart);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-target">Target date</Label>
              <Input
                id="plan-target"
                type="date"
                min={startDate}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="plan-daily">Daily study time (min)</Label>
              <Input
                id="plan-daily"
                type="number"
                min={5}
                max={480}
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-difficulty">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as typeof difficulty)}
              >
                <SelectTrigger id="plan-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="plan-exam">Optional exam date</Label>
            <Input
              id="plan-exam"
              type="date"
              min={startDate}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Preferred study days</Label>
            <div className="flex flex-wrap gap-2">
              {dayLabels.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  aria-pressed={preferredDays.includes(i)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition",
                    preferredDays.includes(i)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Subjects / concepts</Label>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/30 p-2">
              {concepts.length === 0 && (
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Add a concept before creating a plan.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onBrowseConcepts();
                    }}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open Concept Library
                  </button>
                </div>
              )}
              {concepts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleConcept(c.id)}
                  aria-pressed={selectedConcepts.includes(c.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    selectedConcepts.includes(c.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setMode("choose")} disabled={creating}>
            Back
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          {mode === "manual" ? (
            <Button onClick={handleCreateManual} disabled={creating || !title.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Plan
            </Button>
          ) : (
            <>
              {selectedConcepts.length === 0 && (
                <span role="status" className="self-center text-xs text-muted-foreground">
                  Choose at least one concept.
                </span>
              )}
              <Button
                onClick={() => void handleCreateAI()}
                disabled={creating || !title.trim() || selectedConcepts.length === 0}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sparkles className="mr-2 h-4 w-4" />
                {creating ? "Generating plan…" : "Generate Study Plan"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
