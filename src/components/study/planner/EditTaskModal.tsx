import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import type { LearningPlanTask, PlanTaskInput } from "@/lib/learning/types";
import { toast } from "sonner";

interface EditTaskModalProps {
  task: LearningPlanTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concepts: { id: string; title: string }[];
  onSaved: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  onDelete?: () => void;
}

export function EditTaskModal({
  task,
  open,
  onOpenChange,
  concepts,
  onSaved,
  onComplete,
  onSkip,
  onDelete,
}: EditTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [taskType, setTaskType] = useState<PlanTaskInput["taskType"]>("learn");
  const [scheduledDate, setScheduledDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<PlanTaskInput["priority"]>("medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setConceptId(task.concept_id ?? "");
      setTaskType(task.task_type as PlanTaskInput["taskType"]);
      setScheduledDate(new Date(task.due_at).toISOString().slice(0, 10));
      setEstimatedMinutes(task.estimated_minutes);
      setPriority(task.priority as PlanTaskInput["priority"]);
      setNotes(task.notes ?? "");
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const { updatePlanTask } = await import("@/lib/study-plans");
      await updatePlanTask(task.plan_id, task.id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        conceptId: conceptId || undefined,
        taskType,
        scheduledDate,
        estimatedMinutes,
        priority,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? `Could not save task: ${error.message}` : "Could not save task.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit Task</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-task-title">Title</Label>
            <Input id="edit-task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-task-desc">Description</Label>
            <Textarea
              id="edit-task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-task-concept">Concept</Label>
              <Select value={conceptId} onValueChange={setConceptId}>
                <SelectTrigger id="edit-task-concept">
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
              <Label htmlFor="edit-task-type">Type</Label>
              <Select
                value={taskType}
                onValueChange={(v) => setTaskType(v as PlanTaskInput["taskType"])}
              >
                <SelectTrigger id="edit-task-type">
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
              <Label htmlFor="edit-task-date">Date</Label>
              <Input
                id="edit-task-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-task-duration">Duration (min)</Label>
              <Input
                id="edit-task-duration"
                type="number"
                min={5}
                max={480}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as PlanTaskInput["priority"])}
              >
                <SelectTrigger id="edit-task-priority">
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
            <Label htmlFor="edit-task-notes">Notes</Label>
            <Textarea
              id="edit-task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {task.status !== "completed" && task.status !== "skipped" && (
              <>
                <Button variant="outline" size="sm" onClick={onComplete}>
                  Complete
                </Button>
                <Button variant="outline" size="sm" onClick={onSkip}>
                  Skip
                </Button>
              </>
            )}
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              )}
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
