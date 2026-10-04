"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string | number> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** An iOS-style segmented control, big enough for a thumb. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: Readonly<SegmentedProps<T>>) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex rounded-[10px] bg-secondary p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 flex-1 rounded-[8px] px-2 text-sm font-semibold transition-colors",
              o.value === value ? "bg-card shadow" : "text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

/** A − value + stepper, for numbers a coach nudges rather than types. */
export function Stepper({ label, value, min, max, step = 1, suffix, onChange }: Readonly<StepperProps>) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex items-center rounded-[10px] bg-secondary p-0.5">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => set(value - step)}
          className="min-h-11 w-12 rounded-[8px] text-lg font-semibold disabled:opacity-40"
        >
          −
        </button>
        <output className="flex-1 text-center text-sm font-semibold tabular-nums">
          {value}
          {suffix}
        </output>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => set(value + step)}
          className="min-h-11 w-12 rounded-[8px] text-lg font-semibold disabled:opacity-40"
        >
          +
        </button>
      </div>
    </fieldset>
  );
}
