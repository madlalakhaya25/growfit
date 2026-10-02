"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { DrillDetailsView } from "@/components/training/drill-details-view";
import type { DrillDetails } from "@/lib/drill-details";

export interface RunnerDrill {
  id: string;
  title: string;
  description: string | null;
  /** The drill's saved plan, when it has one (migration 052). */
  details?: DrillDetails | null;
}

/** m:ss, minutes unbounded (a long drill never wraps to 0). */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Pitch-side view of a session: one drill at a time, big enough to read at
 * arm's length, with a stopwatch per drill. The timer resets when the coach
 * moves to another drill, so each drill is timed on its own.
 */
export function SessionRunner({ drills }: Readonly<{ drills: RunnerDrill[] }>) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (drills.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Play className="size-5" aria-hidden="true" />
        Run this session
      </button>
    );
  }

  const drill = drills[Math.min(index, drills.length - 1)];
  const go = (next: number) => {
    setIndex(next);
    setSeconds(0);
    setRunning(false);
  };

  return (
    <section aria-label="Run the session" className="space-y-4 rounded-xl border-2 border-primary/40 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">
          Drill {index + 1} of {drills.length}
        </p>
        <button
          type="button"
          onClick={() => { setOpen(false); setRunning(false); }}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Close
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold leading-tight">{drill.title}</h2>
        {drill.details ? (
          <DrillDetailsView details={drill.details} large />
        ) : (
          drill.description && <p className="whitespace-pre-wrap text-base">{drill.description}</p>
        )}
      </div>

      <p
        role="timer"
        aria-label="Time on this drill"
        className="text-center text-6xl font-bold tabular-nums"
      >
        {formatElapsed(seconds)}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {running ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={() => { setSeconds(0); setRunning(false); }}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border text-lg font-semibold hover:bg-muted"
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          Reset
        </button>
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border text-lg font-semibold hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index >= drills.length - 1}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border text-lg font-semibold hover:bg-muted disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
