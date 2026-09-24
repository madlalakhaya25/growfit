import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  /** One human sentence — not an explanation of the feature. */
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * One line, one action. Replaces the dashed-border, multi-paragraph empty
 * state pattern repeated across squad/fixture/training lists — see the
 * Matchday copy rules in docs/AI_FEATURES_AND_IA.md Part 4: cut the
 * paragraph that explains the UI, keep the sentence that tells the coach
 * what to do next.
 */
export function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-5 py-8 text-center", className)}>
      {Icon && <Icon className="size-8 text-muted-foreground/50" />}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
