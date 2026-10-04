// The step timeline under the board (the Coach Tactic Board idea): where each
// step sits on the clock, which step a scrub position belongs to, and the
// per-step durations a coach can pick. Token positions between steps come
// from interpolateFrames() in board-model.ts — the same maths playback, the
// video export and the shared viewer use — so scrubbing shows exactly what
// Play shows. Pure functions only.

import { DEFAULT_FRAME_DURATION_MS, type Frame } from "@/lib/board-model";

/** Shortest and longest a step can take from the timeline's picker. */
export const MIN_STEP_MS = 500;
export const MAX_STEP_MS = 4000;

/** The durations offered on a selected step. */
export const STEP_DURATION_CHOICES_MS: readonly number[] = [500, 750, 1000, 1500, 2000, 2500, 3000, 4000];

/** How long a step takes to arrive — the saved value or the old default, so
 * a play saved before durations existed plays at the same speed. */
export function stepDurationMs(frame: Pick<Frame, "durationMs">): number {
  return frame.durationMs ?? DEFAULT_FRAME_DURATION_MS;
}

/** Keep a picked duration inside the timeline's range, in whole ms. */
export function clampStepDuration(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_FRAME_DURATION_MS;
  return Math.round(Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, ms)));
}

/** The moment (ms from the start) each step is reached. Step 1 is the
 * starting position, at 0. */
export function stepStartTimes(frames: readonly Pick<Frame, "durationMs">[]): number[] {
  const out: number[] = [];
  let acc = 0;
  frames.forEach((f, i) => {
    if (i > 0) acc += stepDurationMs(f);
    out.push(acc);
  });
  return out;
}

/** The last step reached by `ms` — the chip to highlight while scrubbing
 * or playing. -1 for an empty timeline. */
export function stepIndexAt(frames: readonly Pick<Frame, "durationMs">[], ms: number): number {
  const starts = stepStartTimes(frames);
  let idx = -1;
  starts.forEach((start, i) => {
    if (ms >= start) idx = i;
  });
  return idx;
}

/** The picker's options for a step: the standard list, plus the step's own
 * value if it isn't on it (an old play's 1.1s default, say), in order. */
export function durationChoices(currentMs: number): number[] {
  const set = new Set([...STEP_DURATION_CHOICES_MS, currentMs]);
  return [...set].sort((a, b) => a - b);
}

/** "0.5s", "1.1s", "4s" — short, for a chip. */
export function formatSeconds(ms: number): string {
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
}
