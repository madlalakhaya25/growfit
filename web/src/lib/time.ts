/**
 * Every date/time shown to a coach, parent or player should render in the
 * academy's own timezone, not whatever the runtime happens to be in.
 * Vercel functions don't run in Africa/Johannesburg, and every bare
 * `toLocaleDateString`/`toLocaleTimeString`/`toLocaleString` call (58 of
 * them, before this) as well as the Today greeting's `getHours()` used
 * the server's local time with no `timeZone` set anywhere — on a
 * non-SAST host, kickoff times and the greeting read wrong for everyone.
 *
 * Centralised here so the fix is one constant, not 58 call sites each
 * remembering it independently.
 */
export const TIMEZONE = "Africa/Johannesburg";

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * The one place every other helper (and every call site with its own
 * one-off formatting) routes through — merges the academy's timezone into
 * whatever Intl options the caller needs. `toLocaleString` rather than
 * `toLocaleDateString`/`toLocaleTimeString`: passing only date-part
 * options produces a date-only string and passing only time-part options
 * produces a time-only string, so one method covers every case that used
 * to be split across the other two.
 */
export function formatInTimezone(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
  locale = "en-ZA"
): string {
  return toDate(value).toLocaleString(locale, { ...options, timeZone: TIMEZONE });
}

/** "25 Sep" — the single most common shape in this app (fixture/session lists, AI prompt context). */
export function formatDayMonth(value: DateInput): string {
  return formatInTimezone(value, { day: "numeric", month: "short" });
}

/** "14:30" */
export function formatTime(value: DateInput): string {
  return formatInTimezone(value, { hour: "2-digit", minute: "2-digit" });
}

/** "Thu, 25 Sep" */
export function formatWeekdayDayMonth(value: DateInput): string {
  return formatInTimezone(value, { weekday: "short", day: "numeric", month: "short" });
}

/** "25 Sep 2026" */
export function formatDayMonthYear(value: DateInput): string {
  return formatInTimezone(value, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The hour of day (0–23) in the academy's timezone. Never
 * `new Date().getHours()`, which reads whichever timezone the server
 * process itself is running in — the Today greeting's actual reported bug.
 */
export function currentHourInTimezone(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    hour: "2-digit",
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour ? parseInt(hour, 10) : date.getHours();
}
