/**
 * Squad Review: going through a whole team's term review one child at a time.
 * Pure helpers for the order and the progress; the screen lives in
 * components/development/squad-review.tsx.
 */

/** How many categories each child still has to be given a band for. */
export interface ReviewProgress {
  done: number;
  total: number;
  /** Children with every category reviewed. */
  complete: number;
}

export function reviewProgress(doneByChild: number[], categoryCount: number): ReviewProgress {
  return {
    done: doneByChild.reduce((a, b) => a + b, 0),
    total: doneByChild.length * categoryCount,
    complete: doneByChild.filter((d) => d >= categoryCount).length,
  };
}

/**
 * The next child, after `from`, who still has something to review. Wraps round
 * to the start so the coach is never told "no more" while someone is left
 * behind them. Null when every child is complete.
 */
export function nextIncomplete(doneByChild: number[], categoryCount: number, from: number): number | null {
  const n = doneByChild.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (doneByChild[i] < categoryCount) return i;
  }
  return null;
}

/** Index clamped into range, so Previous on the first child and Next on the last do nothing odd. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}
