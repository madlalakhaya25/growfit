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
 * display face (Barlow Condensed) — see globals.css `.font-display`.
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="font-display text-2xl leading-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
