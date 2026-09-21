/**
 * The academy's attendance policy: 75% of training sessions per term,
 * dropping below it is meant to trigger a welfare check-in (per the
 * academy's own policy docs and the AI coach assistant's system prompt).
 * There's no explicit "term" boundary in the schema, so a rolling window is
 * used as the practical proxy — kept here as the one definition, since the
 * squad-context AI brief, the welfare page and the coach squad page all need
 * to agree on exactly the same threshold, window and vocabulary.
 */
export const ATTENDANCE_WINDOW_DAYS = 90;
export const WELFARE_ATTENDANCE_THRESHOLD = 0.75;

/**
 * P/A/L/E — the four states the academy's attendance policy names, and the
 * ones `match_attendance` has carried since migration 012.
 *
 * `training_attendance` was left on migration 005's RSVP vocabulary
 * (`'attending' | 'unavailable'`) when migration 012 repurposed the table for
 * coach-marked registers, so the app's writes violated its CHECK constraint
 * and its readers disagreed about the values. Migration 036 aligns the two
 * tables; this type is the single source of truth for both.
 */
export const ATTENDANCE_STATUSES = ["present", "late", "excused", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Absent",
};

/** Single letters for the compact register view. */
export const ATTENDANCE_INITIALS: Record<AttendanceStatus, string> = {
  present: "P",
  late: "L",
  excused: "E",
  absent: "A",
};

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────
// What the 75% is actually a percentage OF
// ─────────────────────────────────────────────────────────────────

/**
 * Did the player turn up?
 *
 * Late counts. A child who arrives twenty minutes into a Wednesday session
 * because of a taxi still came to training, and a policy whose stated purpose
 * is triggering a welfare conversation should not treat them as having
 * stayed home.
 */
export function countsAsAttended(status: AttendanceStatus): boolean {
  return status === "present" || status === "late";
}

/**
 * Does this mark belong in the denominator?
 *
 * Excused does not. An authorised absence — a family funeral, a school exam,
 * an injury the coach knew about — is the academy agreeing the child should
 * not be there. Counting it against them would mean the more honestly a
 * parent communicates, the worse their child's record looks, which inverts
 * what the policy is for.
 *
 * It is excluded rather than counted as attended, so an excused session
 * neither punishes nor pads the figure.
 */
export function countsTowardTotal(status: AttendanceStatus): boolean {
  return status !== "excused";
}

export interface AttendanceSummary {
  /** Sessions attended (present or late). */
  attended: number;
  /** Sessions that count toward the percentage, i.e. everything but excused. */
  assessed: number;
  /** Whole-number percentage, or null when nothing has been marked. */
  pct: number | null;
  /** Below the policy threshold — false when there is nothing to judge on. */
  belowThreshold: boolean;
}

/**
 * Summarise one player's marks.
 *
 * The denominator is the sessions this player was actually **marked** for,
 * not every session in the window. That is a deliberate change: the old
 * behaviour divided by the number of sessions that existed, so an unmarked
 * register dragged every player down, and a coach who had never marked
 * attendance at all saw their entire squad sitting at 0% and flagged for a
 * welfare check-in. Combined with the constraint bug (migration 036), which
 * made marking impossible in the first place, that is exactly what the
 * welfare surface has been showing.
 *
 * A player with no marks now returns `pct: null` — "not assessed" — which is
 * honest, and keeps them off the welfare list until there is something to go
 * on.
 */
export function summariseAttendance(
  statuses: readonly AttendanceStatus[]
): AttendanceSummary {
  const assessed = statuses.filter(countsTowardTotal).length;
  const attended = statuses.filter(
    (s) => countsTowardTotal(s) && countsAsAttended(s)
  ).length;

  if (assessed === 0) {
    return { attended, assessed, pct: null, belowThreshold: false };
  }

  const ratio = attended / assessed;
  return {
    attended,
    assessed,
    pct: Math.round(ratio * 100),
    belowThreshold: ratio < WELFARE_ATTENDANCE_THRESHOLD,
  };
}

/**
 * Percentage from a raw attended/total pair.
 *
 * Retained for callers that have already done their own counting. Prefer
 * {@link summariseAttendance}, which applies the excused rule for you.
 */
export function attendancePct(attended: number, total: number): number | null {
  return total > 0 ? Math.round((attended / total) * 100) : null;
}

export function isBelowWelfareThreshold(attended: number, total: number): boolean {
  return total > 0 && attended / total < WELFARE_ATTENDANCE_THRESHOLD;
}

/**
 * ISO timestamp for the start of the rolling attendance window.
 *
 * Lives here rather than being spelled out at each call site so the window
 * can only ever be defined once — and so a Server Component reading it
 * isn't computing a timestamp in its own body, which React's purity lint
 * rule flags (it can't tell an async Server Component from a client one).
 */
export function attendanceWindowStart(now: number = Date.now()): string {
  return new Date(now - ATTENDANCE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
}

/**
 * True when a Supabase error means `training_attendance` still carries
 * migration 005's RSVP CHECK constraint and migration 036 has not been run.
 *
 * `23514` is Postgres' check_violation. The app only ever writes values from
 * ATTENDANCE_STATUSES, so on this table that code has exactly one cause —
 * which is worth naming, because the raw message ("violates check constraint
 * training_attendance_status_check") reads as a bug in the app rather than a
 * pending migration.
 */
export function isLegacyAttendanceConstraint(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "23514";
}

export const LEGACY_ATTENDANCE_CONSTRAINT_MESSAGE =
  "Attendance can't be saved because this database is still using the old " +
  "two-option attendance values — an administrator needs to run the pending " +
  "migration (036_training_attendance_status_parity.sql).";
