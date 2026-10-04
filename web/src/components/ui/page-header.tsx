import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  /** A small caption above the title, e.g. today's date, as iOS shows it. */
  eyebrow?: React.ReactNode;
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
export function PageHeader({ title, eyebrow, description, action, className }: Readonly<PageHeaderProps>) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="text-[2.125rem] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
