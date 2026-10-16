/// <reference types="react/jsx-runtime" />

"use client";

import { cn } from "@/lib/utils";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: React.ReactNode;
}

const headingStyles: Record<number, string> = {
  1: "text-3xl font-bold tracking-tight text-white mb-4 mt-8 pb-2 border-b border-border/30",
  2: "text-2xl font-bold tracking-tight text-white mb-3 mt-6 pb-1 border-b border-border/30",
  3: "text-xl font-semibold text-white mb-2 mt-5",
  4: "text-lg font-semibold text-white mb-2 mt-4",
  5: "text-base font-semibold text-white mb-1 mt-3",
  6: "text-sm font-semibold text-foreground/90 mb-1 mt-3",
};

export function Heading({ level, children, className, ...props }: HeadingProps) {
  const Component = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  return (
    <Component className={cn(headingStyles[level], className)} {...props}>
      {children}
    </Component>
  );
}
