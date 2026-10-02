// Squad readiness (docs/AI_AND_UX_PLAN_2026.md step 4.5).
//
// One figure per child from three things a coach already records: how hard the
// last weeks were (session RPE × minutes, plus matches), whether the child is
// still turning up, and whether their match ratings are slipping. Pure and
// deterministic; the wording of every flag is a fixed template. No model ever
// decides a number here, and nothing in this file speaks to a child or parent:
// it is a prompt for the coach to look at a child, not a verdict on one.
//
// Load is the standard sRPE method (Borg CR-10 rating × minutes) and the
// acute:chronic workload ratio (7-day load against the 28-day weekly average),
// flagged at 1.5 and above. Both are guides at youth level, which is why a
// child with too few effort ratings gets no ratio at all rather than a guess.

import { WELFARE_ATTENDANCE_THRESHOLD } from "@/lib/attendance";

/** No session length is recorded, so every training session is taken as one hour (Wednesday and Friday, per the academy's schedule). */
export const SESSION_MINUTES = 60;
/** No minutes-played is recorded either: a match counts as a whole match at the age group's length… */
export const MATCH_MINUTES_BY_GROUP: Record<string, number> = { U11: 50, U13: 60, U15: 70 };
export const DEFAULT_MATCH_MINUTES = 60;
/** …and at a typical match effort, because matches are not rated for effort. */
export const MATCH_RPE = 7;

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;
/** Flag a load ratio at or above this. */
export const ACWR_FLAG = 1.5;
/** Fewer effort-rated loads than this in the chronic window and no ratio is shown. */
export const MIN_LOADS_FOR_RATIO = 4;
/** Compare the latest few ratings with the few before them. */
export const RATING_TREND_WINDOW = 3;
/** A fall of at least this much (out of 5) is worth a look. */
export const RATING_DROP_FLAG = 1;

const DAY_MS = 86_400_000;

export interface SessionEntry {
  date: string;
  /** Present or late. Absent and excused children did no work. */
  attended: boolean;
  /** 1 to 10, or null when the coach did not rate it. */
  rpe: number | null;
}
export interface MatchEntry { date: string; played: boolean }
export interface RatingEntry { date: string; rating: number }

export interface ReadinessInput {
  ageGroup: string | null;
  sessions: SessionEntry[];
  matches: MatchEntry[];
  ratings: RatingEntry[];
  /** Attendance over the welfare window, 0 to 1, or null with no sessions. */
  attendancePct: number | null;
}

export type ReadinessFlag = "load-spike" | "attendance" | "ratings";
export type ReadinessLevel = "steady" | "watch" | "check-in";

export interface Readiness {
  level: ReadinessLevel;
  flags: ReadinessFlag[];
  /** Acute ÷ chronic weekly average, or null when there is too little rated load. */
  acwr: number | null;
  /** Plain-language reasons, one per flag, for the coach. */
  reasons: string[];
  /** True when load could not be judged because effort ratings are missing. */
  needsEffortRatings: boolean;
}

export const matchMinutesFor = (ageGroup: string | null): number =>
  (ageGroup && MATCH_MINUTES_BY_GROUP[ageGroup.toUpperCase()]) || DEFAULT_MATCH_MINUTES;

const daysAgo = (iso: string, now: Date): number => (now.getTime() - new Date(iso).getTime()) / DAY_MS;

interface Loads { acute: number; chronic: number; count: number }

function loadsOf(input: ReadinessInput, now: Date): Loads {
  const minutes = matchMinutesFor(input.ageGroup);
  const events: { date: string; load: number }[] = [
    ...input.sessions.filter((s) => s.attended && s.rpe !== null).map((s) => ({ date: s.date, load: (s.rpe as number) * SESSION_MINUTES })),
    ...input.matches.filter((m) => m.played).map((m) => ({ date: m.date, load: MATCH_RPE * minutes })),
  ];
  let acute = 0, chronic = 0, count = 0;
  for (const e of events) {
    const d = daysAgo(e.date, now);
    if (d < 0 || d >= CHRONIC_DAYS) continue;
    chronic += e.load;
    count++;
    if (d < ACUTE_DAYS) acute += e.load;
  }
  return { acute, chronic, count };
}

/** Acute load over the chronic weekly average. Null when it cannot be judged. */
export function acuteChronicRatio(input: ReadinessInput, now: Date): number | null {
  const { acute, chronic, count } = loadsOf(input, now);
  if (count < MIN_LOADS_FOR_RATIO || chronic === 0) return null;
  const weeklyAverage = chronic / (CHRONIC_DAYS / ACUTE_DAYS);
  return Math.round((acute / weeklyAverage) * 100) / 100;
}

/** Mean of the latest few ratings minus the mean of the few before them, or null with too few. */
export function ratingChange(ratings: RatingEntry[]): number | null {
  const sorted = [...ratings].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < RATING_TREND_WINDOW * 2) return null;
  const mean = (xs: RatingEntry[]) => xs.reduce((s, r) => s + r.rating, 0) / xs.length;
  const recent = sorted.slice(-RATING_TREND_WINDOW);
  const before = sorted.slice(-RATING_TREND_WINDOW * 2, -RATING_TREND_WINDOW);
  return Math.round((mean(recent) - mean(before)) * 100) / 100;
}

export function readiness(input: ReadinessInput, now: Date = new Date()): Readiness {
  const flags: ReadinessFlag[] = [];
  const reasons: string[] = [];

  const acwr = acuteChronicRatio(input, now);
  if (acwr !== null && acwr >= ACWR_FLAG) {
    flags.push("load-spike");
    reasons.push(`This week's load is ${acwr} times their usual. A sudden jump is when children get injured, so ease the next session or ask how they feel.`);
  }
  if (input.attendancePct !== null && input.attendancePct < WELFARE_ATTENDANCE_THRESHOLD) {
    flags.push("attendance");
    reasons.push(`They have been at ${Math.round(input.attendancePct * 100)}% of sessions, below the ${Math.round(WELFARE_ATTENDANCE_THRESHOLD * 100)}% welfare line. A quiet word with them or the family is due.`);
  }
  const change = ratingChange(input.ratings);
  if (change !== null && change <= -RATING_DROP_FLAG) {
    flags.push("ratings");
    reasons.push(`Their last ${RATING_TREND_WINDOW} match ratings are ${Math.abs(change)} lower than the ${RATING_TREND_WINDOW} before. Worth finding out why, as it is often tiredness or something off the pitch.`);
  }

  const level: ReadinessLevel = flags.length >= 2 ? "check-in" : flags.length === 1 ? "watch" : "steady";
  const needsEffortRatings = acwr === null && input.sessions.some((s) => s.attended);
  return { level, flags, acwr, reasons, needsEffortRatings };
}
