import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import type { StudyView } from "./types";

interface StudyHeaderProps {
  view: StudyView;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  className?: string;
  // Optional progress stats
  masteryPercent?: number;
  totalConcepts?: number;
  masteredCount?: number;
}

export function StudyHeader({
  view: _view,
  title,
  subtitle,
  icon,
  action,
  onBack,
  showBack = false,
  className,
  masteryPercent,
  totalConcepts,
  masteredCount,
}: StudyHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:items-center sm:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:border-border hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="break-words font-display text-2xl font-bold tracking-wide text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground/70">{subtitle}</p>}
          {/* Display progress stats if provided */}
          {masteryPercent !== undefined &&
            totalConcepts !== undefined &&
            masteredCount !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Mastery: {masteryPercent}% ({masteredCount} of {totalConcepts} concepts)
              </p>
            )}
        </div>
      </div>
      {action && <div className="flex w-full justify-end sm:w-auto sm:shrink-0">{action}</div>}
    </header>
  );
}
