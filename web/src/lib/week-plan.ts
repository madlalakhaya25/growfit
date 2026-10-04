// The coach's week on one screen: training, match day, plays attached to each,
// and how hard each day is (borrowed from Finalthird's weekly planner). Days are
// labelled against the match the way coaches talk about a microcycle (MD-2,
// MD, MD+1). Pure: dates in, days out; the clock is passed in.

import { todayIso } from "@/lib/time";

export interface PlanSession {
  id: string;
  title: string;
  session_date: string;
  session_type: string;
  /** The squad's recorded effort (Borg CR-10), when the coach set one. */
  rpe?: number | null;
}

export interface PlanFixture {
  id: string;
  opponent: string;
  fixture_date: string;
  is_home: boolean;
  status: string;
}

export interface PlanPlay {
  id: string;
  name: string;
  session_id: string | null;
  fixture_id: string | null;
}

/** 0 rest, 1 light, 2 moderate, 3 hard. */
export type Load = 0 | 1 | 2 | 3;

export interface PlanDay {
  /** YYYY-MM-DD in the academy's timezone. */
  date: string;
  isToday: boolean;
  /** "MD", "MD-2", "MD+1", or null when no match is close. */
  matchDay: string | null;
  sessions: (PlanSession & { load: Load; loadFrom: "planned" | "recorded"; plays: PlanPlay[] })[];
  fixtures: (PlanFixture & { plays: PlanPlay[] })[];
  /** The hardest thing on the day. */
  load: Load;
}

export interface WeekPlan {
  start: string;
  end: string;
  days: PlanDay[];
  warnings: string[];
}

const DAY_MS = 86_400_000;

/** Days after a YYYY-MM-DD date (calendar arithmetic, timezone-free). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday on or before a YYYY-MM-DD date. */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** A valid YYYY-MM-DD from a query string, else null. */
export function parseDay(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const t = Date.parse(`${raw}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== raw ? null : raw;
}

/** The academy-timezone calendar day an instant falls on. */
export function dayOf(iso: string): string {
  return todayIso(new Date(iso));
}

const PLANNED_LOAD: Record<string, Load> = {
  recovery: 1,
  technical: 2,
  general: 2,
  tactical: 2,
  match_prep: 2,
  fitness: 3,
};

/** How hard a session is: the recorded effort when there is one, else what its type implies. */
export function sessionLoad(s: Pick<PlanSession, "session_type" | "rpe">): { load: Load; from: "planned" | "recorded" } {
  if (typeof s.rpe === "number" && Number.isFinite(s.rpe)) {
    let load: Load = 3;
    if (s.rpe <= 3) load = 1;
    else if (s.rpe <= 6) load = 2;
    return { load, from: "recorded" };
  }
  return { load: PLANNED_LOAD[s.session_type] ?? 2, from: "planned" };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/**
 * "MD" on a match day; otherwise counted to the next match within five days
 * ("MD-1" is the day before), or from the last one within two ("MD+1").
 */
export function matchDayLabel(day: string, matchDays: string[]): string | null {
  if (matchDays.includes(day)) return "MD";
  const ahead = matchDays.map((m) => daysBetween(day, m)).filter((d) => d > 0 && d <= 5);
  if (ahead.length) return `MD-${Math.min(...ahead)}`;
  const behind = matchDays.map((m) => daysBetween(m, day)).filter((d) => d > 0 && d <= 2);
  if (behind.length) return `MD+${Math.min(...behind)}`;
  return null;
}

/**
 * The seven days from `start` (a Monday). `fixtures` may reach beyond the
 * week so the MD labels at its edges are right; only those inside it are listed.
 */
export function buildWeekPlan(input: {
  start: string;
  now: Date;
  sessions: PlanSession[];
  fixtures: PlanFixture[];
  plays: PlanPlay[];
}): WeekPlan {
  const today = todayIso(input.now);
  const live = input.fixtures.filter((f) => f.status !== "cancelled");
  const matchDays = [...new Set(live.map((f) => dayOf(f.fixture_date)))];
  const playsFor = (key: "session_id" | "fixture_id", id: string) =>
    input.plays.filter((p) => p[key] === id).sort((a, b) => a.name.localeCompare(b.name));

  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(input.start, i);
    const sessions = input.sessions
      .filter((s) => dayOf(s.session_date) === date)
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map((s) => {
        const { load, from } = sessionLoad(s);
        return { ...s, load, loadFrom: from, plays: playsFor("session_id", s.id) };
      });
    const fixtures = live
      .filter((f) => dayOf(f.fixture_date) === date)
      .sort((a, b) => a.fixture_date.localeCompare(b.fixture_date))
      .map((f) => ({ ...f, plays: playsFor("fixture_id", f.id) }));
    const load = Math.max(0, ...sessions.map((s) => s.load), fixtures.length ? 3 : 0) as Load;
    return { date, isToday: date === today, matchDay: matchDayLabel(date, matchDays), sessions, fixtures, load };
  });

  const warnings: string[] = [];
  for (const d of days) {
    if (d.matchDay === "MD-1" && d.sessions.some((s) => s.load === 3)) {
      warnings.push("A hard session the day before a match. Keep MD-1 light so legs are fresh.");
    }
    if (d.matchDay === "MD+1" && d.sessions.some((s) => s.load === 3)) {
      warnings.push("A hard session the day after a match. MD+1 is for recovery.");
    }
  }
  const hardDays = days.filter((d) => d.load === 3).length;
  if (hardDays >= 4) warnings.push(`${hardDays} hard days this week. Young players need lighter days between them.`);
  if (!days.some((d) => d.sessions.length)) warnings.push("No training planned this week.");

  return { start: input.start, end: addDays(input.start, 6), days, warnings: [...new Set(warnings)] };
}
