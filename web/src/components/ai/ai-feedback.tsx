"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiFeedback } from "@/lib/ai-artefacts";

/**
 * Was this useful? Pressing the active button again clears it (null). The
 * parent owns the value and the persistence -- this is presentation only, so
 * it works the same whether feedback is stored (an artefact exists) or only
 * held for the session.
 */
export function AiFeedbackControl({
  value,
  onChange,
  disabled,
  className,
}: {
  value: AiFeedback | null;
  onChange: (next: AiFeedback | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const btn = (kind: AiFeedback, label: string, Icon: typeof ThumbsUp) => {
    const active = value === kind;
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        onClick={() => onChange(active ? null : kind)}
        className={cn(
          "grid size-8 place-items-center rounded-md transition-colors hover:bg-secondary/60 disabled:opacity-50",
          active ? "bg-secondary text-foreground" : "text-muted-foreground"
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    );
  };
  return (
    <div className={cn("flex items-center gap-0.5", className)} role="group" aria-label="Was this useful?">
      {btn("helpful", "Helpful", ThumbsUp)}
      {btn("not_helpful", "Not helpful", ThumbsDown)}
    </div>
  );
}
