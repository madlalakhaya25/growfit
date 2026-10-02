// Performance curves (docs/AI_AND_UX_PLAN_2026.md step 4.7): three months-by-month
// lines for one child, ratings, attendance and milestones, and a short reading
// of where each is heading. Pure and deterministic: the reading is a fixed
// template over the numbers, so it can never say more than the data does, and
// it is for the coach. Nothing here is shown to a child or parent.

import { countsAsAttended, countsTowardTotal, isAttendanceStatus } from "@/lib/attendance";

export const CURVE_MONTHS = 6;
/** Compare the latest three months with the three before. */
const HALF = CURVE_MONTHS / 2;
/** Differences smaller than these are called steady, not a trend. */
export const RATING_STEADY = 0.3;
export const ATTENDANCE_STEADY = 10;
export const MILESTONE_STEADY = 0;

export interface CurveInput {
  ratings: { date: string; rating: number }[];
  /** Register marks: date of the session and the P/A/L/E status. */
  attendance: { date: string; status: string }[];
  /** Dates milestones were completed. */
  milestones: string[];
}

export interface CurvePoint {
  /** "2026-10" */
  key: string;
  /** "Oct" */
  label: string;
  rating: number | null;
  attendancePct: number | null;
  milestones: number;
}

export type Direction = "up" | "down" | "steady" | "unknown";
export interface Curves {
  points: CurvePoint[];
  reading: { rating: string | null; attendance: string | null; milestones: string | null };
  directions: { rating: Direction; attendance: Direction; milestones: Direction };
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last CURVE_MONTHS calendar months ending with `now`'s, oldest first. */
export function monthSlots(now: Date): { key: string; label: string }[] {
  const slots: { key: string; label: string }[] = [];
  for (let i = CURVE_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    slots.push({ key: monthKey(d), label: MONTH_NAMES[d.getUTCMonth()] });
  }
  return slots;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

function directionOf(recent: number | null, before: number | null, steady: number): Direction {
  if (recent === null || before === null) return "unknown";
  const diff = recent - before;
  if (Math.abs(diff) <= steady) return "steady";
  return diff > 0 ? "up" : "down";
}

/** Mean of the non-null values in a slice of points. */
function sliceMean(points: CurvePoint[], pick: (p: CurvePoint) => number | null): number | null {
  return mean(points.map(pick).filter((v): v is number => v !== null));
}

export function buildCurves(input: CurveInput, now: Date = new Date()): Curves {
  const slots = monthSlots(now);
  const ratingsBy = new Map<string, number[]>();
  const attBy = new Map<string, { attended: number; total: number }>();
  const msBy = new Map<string, number>();

  for (const r of input.ratings) {
    const k = r.date.slice(0, 7);
    ratingsBy.set(k, [...(ratingsBy.get(k) ?? []), r.rating]);
  }
  for (const a of input.attendance) {
    if (!isAttendanceStatus(a.status) || !countsTowardTotal(a.status)) continue;
    const k = a.date.slice(0, 7);
    const cur = attBy.get(k) ?? { attended: 0, total: 0 };
    cur.total++;
    if (countsAsAttended(a.status)) cur.attended++;
    attBy.set(k, cur);
  }
  for (const m of input.milestones) msBy.set(m.slice(0, 7), (msBy.get(m.slice(0, 7)) ?? 0) + 1);

  const points: CurvePoint[] = slots.map(({ key, label }) => {
    const rs = ratingsBy.get(key);
    const at = attBy.get(key);
    return {
      key, label,
      rating: rs ? round1(mean(rs) as number) : null,
      attendancePct: at && at.total > 0 ? Math.round((at.attended / at.total) * 100) : null,
      milestones: msBy.get(key) ?? 0,
    };
  });

  const before = points.slice(0, HALF), recent = points.slice(HALF);
  const rR = sliceMean(recent, (p) => p.rating), rB = sliceMean(before, (p) => p.rating);
  const aR = sliceMean(recent, (p) => p.attendancePct), aB = sliceMean(before, (p) => p.attendancePct);
  const mR = recent.reduce((s, p) => s + p.milestones, 0), mB = before.reduce((s, p) => s + p.milestones, 0);
  const anyMilestones = points.some((p) => p.milestones > 0);

  const directions = {
    rating: directionOf(rR, rB, RATING_STEADY),
    attendance: directionOf(aR, aB, ATTENDANCE_STEADY),
    milestones: anyMilestones ? directionOf(mR, mB, MILESTONE_STEADY) : ("unknown" as Direction),
  };

  const reading = {
    rating: readRating(directions.rating, rR, rB),
    attendance: readAttendance(directions.attendance, aR, aB),
    milestones: readMilestones(directions.milestones, mR, mB),
  };
  return { points, reading, directions };
}

function readRating(d: Direction, recent: number | null, before: number | null): string | null {
  if (d === "unknown" || recent === null || before === null) return null;
  if (d === "steady") return `Match ratings are steady at about ${round1(recent)}.`;
  return `Match ratings are ${d === "up" ? "up" : "down"}, from ${round1(before)} to ${round1(recent)} over the last three months against the three before.`;
}

function readAttendance(d: Direction, recent: number | null, before: number | null): string | null {
  if (d === "unknown" || recent === null || before === null) return null;
  if (d === "steady") return `Training attendance is steady at about ${Math.round(recent)}%.`;
  return `Training attendance is ${d === "up" ? "up" : "down"}, from ${Math.round(before)}% to ${Math.round(recent)}%.`;
}

function readMilestones(d: Direction, recent: number, before: number): string | null {
  if (d === "unknown") return null;
  if (d === "steady") return `Milestones are coming at the same pace (${recent} in the last three months).`;
  return d === "up"
    ? `More milestones lately: ${recent} in the last three months, against ${before} before.`
    : `Fewer milestones lately: ${recent} in the last three months, against ${before} before.`;
}
