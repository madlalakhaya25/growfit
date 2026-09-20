/**
 * The academy's attendance policy: 75% of training sessions per term,
 * dropping below it is meant to trigger a welfare check-in (per the
 * academy's own policy docs and the AI coach assistant's system prompt).
 * There's no explicit "term" boundary in the schema, so a rolling window is
 * used as the practical proxy — kept here as the one definition, since the
 * squad-context AI brief and the welfare check-in surface both need to agree
 * on exactly the same threshold and window.
 */
export const ATTENDANCE_WINDOW_DAYS = 90;
export const WELFARE_ATTENDANCE_THRESHOLD = 0.75;

export function attendancePct(present: number, totalSessions: number): number | null {
  return totalSessions > 0 ? Math.round((present / totalSessions) * 100) : null;
}

export function isBelowWelfareThreshold(present: number, totalSessions: number): boolean {
  return totalSessions > 0 && present / totalSessions < WELFARE_ATTENDANCE_THRESHOLD;
}
