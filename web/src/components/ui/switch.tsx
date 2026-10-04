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
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-card px-4 py-2.5 shadow-card">
      <div className="min-w-0">
        <p className="text-[15px]">{label}</p>
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
          // iOS proportions (51×31) and its green "on", which reads as a
          // setting rather than a brand-red call to action.
          "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-[#248a3d] dark:bg-[#30d158]" : "bg-[#e9e9ea] dark:bg-[#39393d]"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
      <input type="checkbox" name={name} checked={checked} onChange={() => {}} className="hidden" />
    </div>
  );
}
