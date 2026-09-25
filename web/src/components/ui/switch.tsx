"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * A labelled on/off switch that still submits through a plain HTML form --
 * the visible control is a button (for the `role="switch"` semantics), and
 * a same-named checkbox mirrors its state so `FormData` picks it up exactly
 * like any other checkbox (present + "on" when checked, absent otherwise).
 */
export function Switch({ name, defaultChecked = false, label, description, disabled }: SwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => setChecked((v) => !v)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
      <input type="checkbox" name={name} checked={checked} onChange={() => {}} className="hidden" />
    </div>
  );
}
