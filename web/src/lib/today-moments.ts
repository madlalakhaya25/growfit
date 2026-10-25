import { formatInTimezone, todayIso } from "@/lib/time";

/**
 * Small, human pieces of Coach Today (2026-10-25 redesign): how long until the
 * next thing, and whose birthday is coming up. Kept pure so the wording is
 * tested; the page only fetches and lays out.
 */

const DAY = 86_400_000;

/** Whole calendar days from `now` to `when`, in academy time (0 = today). */
export function calendarDaysUntil(when: Date | string, now: Date = new Date()): number {
  const a = Date.parse(`${todayIso(now)}T00:00:00Z`);
  const b = Date.parse(`${todayIso(new Date(when))}T00:00:00Z`);
  return Math.round((b - a) / DAY);
}

/**
 * "In 1 h 40 min", "On now", "Tomorrow", "Sat". `startedLabel` is what to say
 * once the start has passed (a match is "Kicked off", a session "On now").
 */
export function whenLabel(when: Date | string, now: Date = new Date(), startedLabel = "On now"): string {
  const ms = new Date(when).getTime() - now.getTime();
  const days = calendarDaysUntil(when, now);
  if (ms <= 0) return startedLabel;
  if (days === 0) {
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `In ${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `In ${h} h ${m} min` : `In ${h} h`;
  }
  if (days === 1) return "Tomorrow";
  return formatInTimezone(when, { weekday: "long" });
}

export interface BirthdayInput {
  firstName: string;
  dateOfBirth: string | null;
  teamLabel: string;
}

export interface Birthday {
  firstName: string;
  turns: number;
  inDays: number;
  /** "today", "tomorrow", "on Friday" */
  when: string;
  teamLabel: string;
}

/**
 * Birthdays from today to `windowDays` ahead, soonest first. First names only:
 * this is a nudge to say happy birthday at training, not a record.
 */
export function upcomingBirthdays(players: readonly BirthdayInput[], now: Date = new Date(), windowDays = 7): Birthday[] {
  const today = todayIso(now);
  const year = Number(today.slice(0, 4));
  const out: Birthday[] = [];
  for (const p of players) {
    const m = p.dateOfBirth && /^(\d{4})-(\d{2})-(\d{2})/.exec(p.dateOfBirth);
    if (!m) continue;
    for (const y of [year, year + 1]) {
      // 29 Feb falls on 1 Mar in a year without one, as Date.UTC rolls it.
      const next = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]), 10));
      const inDays = Math.round((Date.parse(next.toISOString().slice(0, 10)) - Date.parse(today)) / DAY);
      if (inDays < 0) continue;
      if (inDays <= windowDays) {
        out.push({
          firstName: p.firstName,
          turns: y - Number(m[1]),
          inDays,
          when: inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `on ${formatInTimezone(next, { weekday: "long" })}`,
          teamLabel: p.teamLabel,
        });
      }
      break;
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
