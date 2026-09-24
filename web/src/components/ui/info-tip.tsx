"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A "?" button that reveals a short explanation on demand. Existing pages
 * often printed the explanation as a permanent paragraph under every
 * heading; InfoTip tucks that away so a returning coach isn't re-reading
 * the same onboarding copy on their hundredth visit. Use sparingly — most
 * copy should just be cut, not hidden (see the Matchday copy rules in
 * docs/AI_FEATURES_AND_IA.md Part 4).
 */
export function InfoTip({ children, className }: InfoTipProps) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        aria-label="More information"
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-border bg-popover p-2.5 text-xs text-popover-foreground shadow-md"
        >
          {children}
        </span>
      )}
    </span>
  );
}
