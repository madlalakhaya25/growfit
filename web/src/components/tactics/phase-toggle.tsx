"use client";

import { type Phase, type PhaseShapes, phaseOptions } from "@/lib/board-phases";

export interface PhaseToggleProps {
  value: Phase;
  /** The board's stored shapes, which decide whether "Formation" is offered. */
  phases?: PhaseShapes;
  onChange: (phase: Phase) => void;
  disabled?: boolean;
}

/** "Formation" / "With the ball" / "Without the ball": flips both teams
 * between their shapes. An iOS-style segmented control. */
export function PhaseToggle({ value, phases, onChange, disabled }: Readonly<PhaseToggleProps>) {
  return (
    <div role="group" aria-label="Our shape" className="inline-flex rounded-[10px] bg-secondary p-0.5">
      {phaseOptions(phases).map((p) => {
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
