"use client";

import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, weekdayOf, weeklyRepeatStarts, weeksAfter } from "@/lib/recurring-sessions";

export interface RepeatWeekly {
  on: boolean;
  /** Weekdays to repeat on, `Date#getUTCDay()` numbering (0 = Sunday). */
  days: number[];
  /** Last day to repeat on, `YYYY-MM-DD`. */
  until: string;
}

export const REPEAT_OFF: RepeatWeekly = { on: false, days: [], until: "" };

/**
 * "Repeat every week" for a new training session: the weekdays to repeat on
 * and the last date. Turning it on picks the session's own weekday and eight
 * weeks ahead, so the common case (same day all term) is one tap.
 */
export function RepeatWeeklyFields({
  sessionDate,
  value,
  onChange,
}: Readonly<{ sessionDate: string; value: RepeatWeekly; onChange: (next: RepeatWeekly) => void }>) {
  const count = value.on ? weeklyRepeatStarts(sessionDate, value.days, value.until).length : 1;

  const toggle = (on: boolean) => {
    if (!on) return onChange(REPEAT_OFF);
    const day = weekdayOf(sessionDate);
    onChange({ on: true, days: day === null ? [] : [day], until: weeksAfter(sessionDate, 8) });
  };

  const toggleDay = (day: number) =>
    onChange({ ...value, days: value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day] });

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.on}
          onChange={(e) => toggle(e.target.checked)}
          className="h-5 w-5 rounded border-input accent-primary"
        />
        <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden />
        Repeat every week
      </label>

      {value.on && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">On</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ day, short }) => {
                const selected = value.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="repeat-until" className="text-sm font-medium">Until</label>
            <input
              id="repeat-until"
              type="date"
              value={value.until}
              min={sessionDate.slice(0, 10)}
              onChange={(e) => onChange({ ...value, until: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {count === 1
              ? "Only this session. Pick a weekday and a later date to repeat it."
              : `Creates up to ${count} sessions, each with its own register. Days the team already has a session are skipped.`}
          </p>
        </div>
      )}
    </div>
  );
}
