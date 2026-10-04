"use client";

import { PHASES, type Phase } from "@/lib/board-phases";

export interface PhaseToggleProps {
  value: Phase;
  onChange: (phase: Phase) => void;
  disabled?: boolean;
}

/** "With the ball" / "Without the ball": flips our team between its two
 * shapes. An iOS-style two-segment control. */
export function PhaseToggle({ value, onChange, disabled }: Readonly<PhaseToggleProps>) {
  return (
    <div role="group" aria-label="Our shape" className="inline-flex rounded-[10px] bg-secondary p-0.5">
      {PHASES.map((p) => {
        const selected = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => { if (!selected) onChange(p.id); }}
            className={`h-11 sm:h-9 rounded-[8px] px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              selected ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
