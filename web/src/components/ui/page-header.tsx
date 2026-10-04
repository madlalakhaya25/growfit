import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A single primary action — a button or link, right-aligned. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Display title for a page or section, one primary action, done. Replaces
 * the ad-hoc `<h1 className="text-2xl font-bold">...` pattern that was
 * copy-pasted with small variations across ~40 pages. Title renders in the
 * word face, extra bold and tight, like a phone's large title; the condensed
 * display face is kept for numbers (globals.css `.font-display`).
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
