/**
 * Repeating a training session every week.
 *
 * The academy trains on the same weekdays all term, but every session used to
 * be created by hand, so a register only existed if a coach remembered to make
 * one first. Repeating at creation time turns one form into the whole term's
 * sessions, each an ordinary session the coach can edit or delete.
 *
 * Works on `datetime-local` values ("2026-10-15T17:00") and plain dates, never
 * on instants, so the time of day stays exactly what the coach typed.
 */

/** Most sessions one repeat may create: two a week for a long school term. */
export const MAX_REPEATED_SESSIONS = 30;

/** Weekday labels by `Date#getUTCDay()` index, Monday first for display order. */
export const WEEKDAYS = [
  { day: 1, short: "Mon" },
  { day: 2, short: "Tue" },
  { day: 3, short: "Wed" },
  { day: 4, short: "Thu" },
  { day: 5, short: "Fri" },
  { day: 6, short: "Sat" },
  { day: 0, short: "Sun" },
] as const;

const DAY_MS = 86_400_000;

function parseDay(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

const formatDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The weekday (0 = Sunday) of a `datetime-local` value or date, or null. */
export function weekdayOf(value: string): number | null {
  const t = parseDay(value.slice(0, 10));
  return t === null ? null : new Date(t).getUTCDay();
}

/** A date `weeks` weeks after the date part of `value`, as `YYYY-MM-DD`. */
export function weeksAfter(value: string, weeks: number): string {
  const t = parseDay(value.slice(0, 10));
  return t === null ? "" : formatDay(t + weeks * 7 * DAY_MS);
}

/**
 * Every session start from `start` up to and including `until` that falls on
 * one of `weekdays`, at `start`'s time of day. `start` itself is always first,
 * whatever its weekday, so the session the coach is looking at is never
 * dropped. Capped at MAX_REPEATED_SESSIONS; empty when the input is invalid.
 */
export function weeklyRepeatStarts(start: string, weekdays: number[], until: string): string[] {
  const m = /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2})?)$/.exec(start);
  const first = m ? parseDay(m[1]) : null;
  const last = parseDay(until);
  if (!m || first === null || last === null || last < first) return m && first !== null ? [start] : [];

  const days = new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  const starts = [start];
  for (let t = first + DAY_MS; t <= last && starts.length < MAX_REPEATED_SESSIONS; t += DAY_MS) {
    if (days.has(new Date(t).getUTCDay())) starts.push(`${formatDay(t)}${m[2]}`);
  }
  return starts;
}
