import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Archive, Pause, Play, Copy, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { LearningPlan, PlanInput } from "@/lib/learning/types";
import { toast } from "sonner";

interface EditPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: LearningPlan | null;
  onSaved: () => void;
  onArchive?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function EditPlanModal({
  open,
  onOpenChange,
  plan,
  onSaved,
  onArchive,
  onPause,
  onResume,
  onDuplicate,
  onDelete,
}: EditPlanModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (plan) {
      setTitle(plan.title);
      setDescription(plan.description ?? "");
      setStartDate(plan.starts_on);
      setTargetDate(plan.ends_on);
      setDailyMinutes(plan.daily_minutes ?? 120);
    }
  }, [plan]);

  const handleSave = async () => {
    if (!plan || !title.trim()) return;
    setSaving(true);
    try {
      const { updateStudyPlan } = await import("@/lib/study-plans");
      await updateStudyPlan(plan.id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        startDate,
        targetDate,
        dailyMinutes,
      });
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? `Could not save plan: ${error.message}` : "Could not save plan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const isPaused = plan?.status === "paused";
  const isArchived = plan?.status === "archived";
  const isCompleted = plan?.status === "completed";

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Plan</DialogTitle>
            <DialogDescription>Update your study plan details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Plan name</Label>
              <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-start">Start date</Label>
                <Input
                  id="edit-start"
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
                <Label htmlFor="edit-target">Target date</Label>
                <Input
                  id="edit-target"
                  type="date"
                  min={startDate}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-daily">Daily study time (min)</Label>
              <Input
                id="edit-daily"
                type="number"
                min={5}
                max={480}
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 sm:mr-auto">
              {!isArchived && !isCompleted && (
                <>
                  {isPaused ? (
                    <Button variant="outline" size="sm" onClick={onResume}>
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onPause}>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={onArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                  <Button variant="outline" size="sm" onClick={onDuplicate}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                </>
              )}
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
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
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{plan?.title}" and all its tasks. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
