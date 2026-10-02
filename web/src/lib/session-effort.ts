// How hard a training session was, as the coach would say it. The coach taps one
// word for the squad (not a number per child at the touchline); each word is a
// Borg CR-10 value the readiness figure can use (lib/readiness.ts).

import { ATTENDANCE_STATUSES, countsAsAttended } from "@/lib/attendance";

/** The register marks that did the session, and so carry an effort. Same rule as the 75% line: late counts, excused and absent do not. */
export const EFFORT_STATUSES: string[] = ATTENDANCE_STATUSES.filter(countsAsAttended);

export const EFFORT_LEVELS = [
  { label: "Easy", rpe: 3 },
  { label: "Okay", rpe: 5 },
  { label: "Hard", rpe: 7 },
  { label: "Very hard", rpe: 9 },
] as const;

/** The word for a stored value, picking the nearest level. */
export function effortLabel(rpe: number | null | undefined): string | null {
  if (rpe === null || rpe === undefined || Number.isNaN(rpe)) return null;
  return EFFORT_LEVELS.reduce((best, l) => (Math.abs(l.rpe - rpe) <= Math.abs(best.rpe - rpe) ? l : best)).label;
}

/** The most common stored value among a session's rows, or null if none are rated. */
export function sessionEffort(rpes: (number | null)[]): number | null {
  const counts = new Map<number, number>();
  for (const r of rpes) if (r !== null) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best: number | null = null;
  for (const [value, n] of counts) {
    if (best === null || n > (counts.get(best) ?? 0) || (n === counts.get(best) && value > best)) best = value;
  }
  return best;
}
