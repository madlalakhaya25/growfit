// Ball-skill home challenges (idea borrowed from TopTekkers): a short catalogue
// of ball-mastery tests a child can do in the garden or against a wall, with a
// bronze, silver and gold target per age group. The catalogue lives here, not
// in the database: coaches assign a challenge by its key, children log scores
// against it (migration 064).
//
// THE TARGETS ARE A STARTING POINT. They were written to be reachable for most
// children in the age group with a few weeks of practice, not taken from a
// published norm. Coaches should adjust them once they see real scores.
//
// Pure: no database, no clock (dates are passed in).

import { addDays, dayOf, mondayOf } from "@/lib/week-plan";

export type SkillAgeBand = "U11" | "U13" | "U15";
export type Trophy = "bronze" | "silver" | "gold";
export type ChallengeUnit = "count" | "seconds";
/** "higher": more is better (touches). "lower": faster is better (a timed run). */
export type ChallengeBetter = "higher" | "lower";

export interface TrophyTargets {
  bronze: number;
  silver: number;
  gold: number;
}

export interface SkillChallenge {
  key: string;
  name: string;
  /** Two or three short steps a child can follow without an adult. */
  steps: readonly string[];
  unit: ChallengeUnit;
  better: ChallengeBetter;
  /** What the number means, e.g. "touches in 30 seconds". */
  measure: string;
  targets: Readonly<Record<SkillAgeBand, TrophyTargets>>;
}

export const SKILL_AGE_BANDS: readonly SkillAgeBand[] = ["U11", "U13", "U15"];
export const TROPHIES: readonly Trophy[] = ["bronze", "silver", "gold"];
export const TROPHY_LABELS: Record<Trophy, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

/** Shown wherever targets are, so nobody reads them as an official standard. */
export const TARGETS_NOTE = "Targets are a starting point. Your coach can change them.";

export const SKILL_CHALLENGES: readonly SkillChallenge[] = [
  {
    key: "keepy_uppies",
    name: "Keepy-uppies",
    steps: [
      "Drop the ball onto your foot and keep it up.",
      "Use feet, thighs or head. No hands.",
      "Count every touch until the ball hits the ground.",
    ],
    unit: "count",
    better: "higher",
    measure: "touches in a row",
    targets: { U11: { bronze: 10, silver: 25, gold: 50 }, U13: { bronze: 25, silver: 60, gold: 120 }, U15: { bronze: 50, silver: 120, gold: 250 } },
  },
  {
    key: "toe_taps_30",
    name: "Toe taps in 30 seconds",
    steps: [
      "Stand behind the ball.",
      "Tap the top of the ball with one foot, then the other, like running on the spot.",
      "Count every tap in 30 seconds.",
    ],
    unit: "count",
    better: "higher",
    measure: "taps in 30 seconds",
    targets: { U11: { bronze: 30, silver: 45, gold: 60 }, U13: { bronze: 40, silver: 60, gold: 80 }, U15: { bronze: 50, silver: 70, gold: 90 } },
  },
  {
    key: "sole_rolls_30",
    name: "Sole rolls in 30 seconds",
    steps: [
      "Put the sole of your foot on top of the ball.",
      "Roll it across your body and catch it with the other sole.",
      "Count every roll in 30 seconds.",
    ],
    unit: "count",
    better: "higher",
    measure: "rolls in 30 seconds",
    targets: { U11: { bronze: 15, silver: 25, gold: 35 }, U13: { bronze: 20, silver: 32, gold: 45 }, U15: { bronze: 25, silver: 40, gold: 55 } },
  },
  {
    key: "inside_outside_30",
    name: "Inside-outside touches",
    steps: [
      "Touch the ball out with the outside of your foot.",
      "Bring it back with the inside of the same foot.",
      "Count every touch in 30 seconds. Swap feet next time.",
    ],
    unit: "count",
    better: "higher",
    measure: "touches in 30 seconds",
    targets: { U11: { bronze: 20, silver: 30, gold: 40 }, U13: { bronze: 25, silver: 38, gold: 50 }, U15: { bronze: 30, silver: 45, gold: 60 } },
  },
  {
    key: "drag_backs_30",
    name: "Drag-backs",
    steps: [
      "Pull the ball back with the sole of your foot.",
      "Push it forward with the other foot and pull it back again.",
      "Count every pull in 30 seconds.",
    ],
    unit: "count",
    better: "higher",
    measure: "drag-backs in 30 seconds",
    targets: { U11: { bronze: 12, silver: 18, gold: 24 }, U13: { bronze: 15, silver: 22, gold: 30 }, U15: { bronze: 18, silver: 26, gold: 34 } },
  },
  {
    key: "wall_passes_60",
    name: "Wall passes in 60 seconds",
    steps: [
      "Stand three big steps from a wall.",
      "Pass against the wall and pass the rebound straight back.",
      "Count every pass that hits the wall in 60 seconds.",
    ],
    unit: "count",
    better: "higher",
    measure: "passes in 60 seconds",
    targets: { U11: { bronze: 20, silver: 30, gold: 40 }, U13: { bronze: 30, silver: 42, gold: 55 }, U15: { bronze: 40, silver: 52, gold: 65 } },
  },
  {
    key: "weak_foot_wall_passes_60",
    name: "Weaker-foot wall passes",
    steps: [
      "Stand three big steps from a wall.",
      "Pass and control using only your weaker foot.",
      "Count every pass that hits the wall in 60 seconds.",
    ],
    unit: "count",
    better: "higher",
    measure: "weaker-foot passes in 60 seconds",
    targets: { U11: { bronze: 12, silver: 20, gold: 28 }, U13: { bronze: 18, silver: 28, gold: 38 }, U15: { bronze: 25, silver: 35, gold: 45 } },
  },
  {
    key: "thigh_juggles",
    name: "Thigh keepy-uppies",
    steps: [
      "Drop the ball onto your thigh.",
      "Keep it up using thighs only, left and right.",
      "Count every touch until it drops.",
    ],
    unit: "count",
    better: "higher",
    measure: "thigh touches in a row",
    targets: { U11: { bronze: 5, silver: 12, gold: 25 }, U13: { bronze: 10, silver: 25, gold: 50 }, U15: { bronze: 20, silver: 40, gold: 80 } },
  },
  {
    key: "cone_weave",
    name: "Cone weave",
    steps: [
      "Put six cones (or shoes) in a line, one big step apart.",
      "Dribble in and out of them to the end and back.",
      "Time it in whole seconds. Knock a cone, start again.",
    ],
    unit: "seconds",
    better: "lower",
    measure: "seconds, there and back",
    targets: { U11: { bronze: 25, silver: 20, gold: 16 }, U13: { bronze: 22, silver: 18, gold: 14 }, U15: { bronze: 20, silver: 16, gold: 12 } },
  },
  {
    key: "figure_eight",
    name: "Figure-of-eight dribble",
    steps: [
      "Put two cones four big steps apart.",
      "Dribble a figure of eight around them, three times.",
      "Time it in whole seconds, keeping the ball close.",
    ],
    unit: "seconds",
    better: "lower",
    measure: "seconds for three laps",
    targets: { U11: { bronze: 30, silver: 25, gold: 20 }, U13: { bronze: 26, silver: 21, gold: 17 }, U15: { bronze: 23, silver: 19, gold: 15 } },
  },
];

const BY_KEY = new Map(SKILL_CHALLENGES.map((c) => [c.key, c]));

export function getSkillChallenge(key: string): SkillChallenge | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * The target band for a team's age group ("U12" reads as U13: the nearer,
 * harder band, so an in-between team is never handed the easier targets). An
 * unknown or missing age group gets the middle band.
 */
export function skillAgeBand(ageGroup: string | null | undefined): SkillAgeBand {
  const n = Number.parseInt(/(\d+)/.exec(ageGroup ?? "")?.[1] ?? "", 10);
  if (!Number.isFinite(n)) return "U13";
  if (n <= 11) return "U11";
  if (n <= 13) return "U13";
  return "U15";
}

/** Highest score the app accepts: well above any real result, low enough to catch a typo. */
export const MAX_COUNT = 2000;
export const MAX_SECONDS = 600;

/** A whole number a child could really have scored on this challenge. */
export function isValidScore(challenge: SkillChallenge, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (challenge.unit === "seconds") return value >= 1 && value <= MAX_SECONDS;
  return value >= 0 && value <= MAX_COUNT;
}

function meets(better: ChallengeBetter, value: number, target: number): boolean {
  return better === "higher" ? value >= target : value <= target;
}

/** The trophy a score earns for an age band, or null when it is short of bronze. */
export function trophyFor(challenge: SkillChallenge, band: SkillAgeBand, value: number): Trophy | null {
  const t = challenge.targets[band];
  if (meets(challenge.better, value, t.gold)) return "gold";
  if (meets(challenge.better, value, t.silver)) return "silver";
  if (meets(challenge.better, value, t.bronze)) return "bronze";
  return null;
}

/** The best of a list of scores (most touches, or fastest time), or null when there are none. */
export function personalBest(challenge: Pick<SkillChallenge, "better">, values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce(
    (best, v) => (challenge.better === "higher" ? Math.max(best, v) : Math.min(best, v)),
    values[0]
  );
}

/** The next trophy up and the score it needs, or null when gold is already won. */
export function nextTarget(challenge: SkillChallenge, band: SkillAgeBand, best: number | null): { trophy: Trophy; target: number } | null {
  const have = best === null ? null : trophyFor(challenge, band, best);
  const next = TROPHIES[have === null ? 0 : TROPHIES.indexOf(have) + 1];
  return next ? { trophy: next, target: challenge.targets[band][next] } : null;
}

/**
 * Weeks in a row (Monday to Sunday, academy time) with at least one logged
 * attempt, counting back from this week. A week not yet tried does not break
 * the streak until it is over, so on a Monday last week's streak still shows.
 */
export function weeklyStreak(loggedAt: readonly string[], today: string): number {
  const weeks = new Set(loggedAt.map((iso) => mondayOf(dayOf(iso))));
  let week = mondayOf(today);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

export interface AttemptRow {
  player_id: string;
  challenge_key: string;
  value: number;
  logged_at: string;
}

export interface ChallengeResult {
  challenge: SkillChallenge;
  best: number | null;
  trophy: Trophy | null;
  attempts: number;
  lastLoggedAt: string | null;
}

/** One player's best and trophy on one challenge, from their attempt rows. */
export function resultFor(challenge: SkillChallenge, band: SkillAgeBand, rows: readonly AttemptRow[]): ChallengeResult {
  const mine = rows.filter((r) => r.challenge_key === challenge.key);
  const best = personalBest(challenge, mine.map((r) => r.value));
  const lastLoggedAt = mine.reduce<string | null>((latest, r) => (latest === null || r.logged_at > latest ? r.logged_at : latest), null);
  return { challenge, best, trophy: best === null ? null : trophyFor(challenge, band, best), attempts: mine.length, lastLoggedAt };
}

/** Every trophy a player holds, best first: the "evidence" list for the Technical category. */
export function trophyCabinet(band: SkillAgeBand, rows: readonly AttemptRow[]): ChallengeResult[] {
  const rank = (t: Trophy | null) => (t === null ? -1 : TROPHIES.indexOf(t));
  return SKILL_CHALLENGES.map((c) => resultFor(c, band, rows))
    .filter((r) => r.trophy !== null)
    .sort((a, b) => rank(b.trophy) - rank(a.trophy) || a.challenge.name.localeCompare(b.challenge.name));
}

export interface TeamChallengeRow {
  playerId: string;
  name: string;
  result: ChallengeResult;
}

/**
 * The coach's per-challenge picture: who has done it (best first) and who has
 * not yet, for a gentle reminder at training. No messages are sent.
 */
export function teamChallengeSummary(
  challenge: SkillChallenge,
  band: SkillAgeBand,
  players: readonly { id: string; name: string }[],
  rows: readonly AttemptRow[]
): { done: TeamChallengeRow[]; notYet: { playerId: string; name: string }[] } {
  const done: TeamChallengeRow[] = [];
  const notYet: { playerId: string; name: string }[] = [];
  for (const p of players) {
    const result = resultFor(challenge, band, rows.filter((r) => r.player_id === p.id));
    if (result.attempts > 0) done.push({ playerId: p.id, name: p.name, result });
    else notYet.push({ playerId: p.id, name: p.name });
  }
  const sign = challenge.better === "higher" ? -1 : 1;
  done.sort((a, b) => sign * ((a.result.best ?? 0) - (b.result.best ?? 0)) || a.name.localeCompare(b.name));
  notYet.sort((a, b) => a.name.localeCompare(b.name));
  return { done, notYet };
}

/** A score for display: "42" for counts, "18 s" for times. */
export function formatScore(challenge: Pick<SkillChallenge, "unit">, value: number): string {
  return challenge.unit === "seconds" ? `${value} s` : String(value);
}

export interface ChallengeAssignment {
  id: string;
  player_id: string | null;
  challenge_key: string;
  due_on: string;
}

export interface AssignedChallenge {
  assignmentId: string;
  challenge: SkillChallenge;
  dueOn: string;
  personal: boolean;
}

/**
 * What one player has been asked to do: assignments for the whole team or for
 * them alone, one per challenge (the latest due date wins), soonest due first.
 * Keys no longer in the catalogue are dropped.
 */
export function assignedForPlayer(assignments: readonly ChallengeAssignment[], playerId: string): AssignedChallenge[] {
  const byKey = new Map<string, ChallengeAssignment>();
  for (const a of assignments) {
    if (a.player_id !== null && a.player_id !== playerId) continue;
    if (!getSkillChallenge(a.challenge_key)) continue;
    const seen = byKey.get(a.challenge_key);
    if (!seen || a.due_on > seen.due_on) byKey.set(a.challenge_key, a);
  }
  const out: AssignedChallenge[] = [];
  for (const a of byKey.values()) {
    const challenge = getSkillChallenge(a.challenge_key);
    if (challenge) out.push({ assignmentId: a.id, challenge, dueOn: a.due_on, personal: a.player_id !== null });
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.challenge.name.localeCompare(b.challenge.name));
}
