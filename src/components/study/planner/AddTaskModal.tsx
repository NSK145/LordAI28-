import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Plus, BookOpen } from "lucide-react";
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
import type { LearningConcept, PlanTaskInput } from "@/lib/learning/types";
import { toast } from "sonner";

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  userId: string | null;
  concepts: LearningConcept[];
  onAdded: () => void;
}

export function AddTaskModal({
  open,
  onOpenChange,
  planId,
  userId,
  concepts,
  onAdded,
}: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [taskType, setTaskType] = useState<PlanTaskInput["taskType"]>("learn");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<PlanTaskInput["priority"]>("medium");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"task" | "curriculum">("task");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setConceptId("");
      setTaskType("learn");
      setScheduledDate(new Date().toISOString().slice(0, 10));
      setEstimatedMinutes(30);
      setPriority("medium");
      setNotes("");
      setMode("task");
    }
  }, [open]);

  const handleAdd = async () => {
    if (!userId || !title.trim()) return;
    setAdding(true);
    try {
      const { addPlanTask } = await import("@/lib/study-plans");
      await addPlanTask(planId, {
        title: title.trim(),
        description: description.trim() || undefined,
        conceptId: conceptId || undefined,
        taskType,
        scheduledDate,
        estimatedMinutes,
        priority,
        notes: notes.trim() || undefined,
      });
      await onAdded();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? `Could not add task: ${error.message}` : "Could not add task.",
      );
    } finally {
      setAdding(false);
    }
  };

  const addFromCurriculum = async (concept: LearningConcept) => {
    setAdding(true);
    try {
      const { addPlanTask } = await import("@/lib/study-plans");
      await addPlanTask(planId, {
        title: `Learn: ${concept.title}`,
        conceptId: concept.id,
        taskType: "learn",
        scheduledDate,
        estimatedMinutes: concept.estimated_study_minutes ?? 20,
        priority: "medium",
      });
      await onAdded();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? `Could not add task: ${error.message}` : "Could not add task.",
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !adding && onOpenChange(nextOpen)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Task</DialogTitle>
          <DialogDescription>Add a new task to your study plan.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border/30 pb-2">
          <button
            onClick={() => setMode("task")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              mode === "task"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Custom Task
          </button>
          <button
            onClick={() => setMode("curriculum")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              mode === "curriculum"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Add from Curriculum
          </button>
        </div>

        <div className="grid gap-4 py-4">
          {mode === "task" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="task-title">Task title</Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Review Chapter 5 notes"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="task-concept">Concept / subject</Label>
                  <Select value={conceptId} onValueChange={setConceptId}>
                    <SelectTrigger id="task-concept">
                      <SelectValue placeholder="Select concept" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {concepts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="task-type">Task type</Label>
                  <Select
                    value={taskType}
                    onValueChange={(v) => setTaskType(v as PlanTaskInput["taskType"])}
                  >
                    <SelectTrigger id="task-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="learn">Learn</SelectItem>
                      <SelectItem value="practice">Practice</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="flashcards">Flashcards</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="task-date">Date</Label>
                  <Input
                    id="task-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="task-duration">Duration (min)</Label>
                  <Input
                    id="task-duration"
                    type="number"
                    min={5}
                    max={480}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as PlanTaskInput["priority"])}
                  >
                    <SelectTrigger id="task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="task-notes">Notes</Label>
                <Textarea
                  id="task-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
            </>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {concepts.length === 0 && (
                <p className="text-sm text-muted-foreground">No concepts available.</p>
              )}
              {concepts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addFromCurriculum(c)}
                  disabled={adding}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/30 bg-card/40 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.subject} · {c.estimated_study_minutes ?? 20} min
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === "task" && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={adding || !title.trim()}>
              {adding && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              )}
              Add Task
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
