import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit3,
  Clock,
  GripHorizontal,
  Copy,
  SkipForward,
  CheckCircle2,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskContextMenuProps {
  taskId: string;
  planId: string;
  status: string;
  onEdit: () => void;
  onReschedule: () => void;
  onDurationChange: () => void;
  onPriorityChange: () => void;
  onMoveDay: () => void;
  onDuplicate: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function TaskContextMenu({
  onEdit,
  onReschedule,
  onDurationChange,
  onPriorityChange,
  onMoveDay,
  onDuplicate,
  onSkip,
  onComplete,
  onDelete,
}: TaskContextMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Task actions"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "rounded-lg p-1.5 transition",
          open
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-border/40 bg-card/95 p-1 shadow-xl backdrop-blur-xl"
            >
              <button
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onReschedule();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
              >
                <Clock className="h-3.5 w-3.5" />
                Reschedule
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onDurationChange();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
              >
                <Clock className="h-3.5 w-3.5" />
                Change duration
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onPriorityChange();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
              >
                <GripHorizontal className="h-3.5 w-3.5" />
                Change priority
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onMoveDay();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
              >
                <Clock className="h-3.5 w-3.5" />
                Move to another day
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onDuplicate();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              {status !== "completed" && status !== "skipped" && (
                <>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onSkip();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-primary/5"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onComplete();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark complete
                  </button>
                </>
              )}
              <div className="my-1 h-px bg-border/30" />
              <button
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
