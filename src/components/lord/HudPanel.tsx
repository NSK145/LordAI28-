import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HudPanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function HudPanel({ title, subtitle, className, action, children }: HudPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-slate-950/55 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
            <h3 className="font-display text-sm font-semibold tracking-wide text-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
