// Fair playing time for match day.
//
// Grassroots squads (U11, U13) should get roughly equal minutes. A coach picks
// who is available, how long the match is, how many play at once and how often
// to make changes; this builds a rotation that keeps every outfield child within
// one change interval of everyone else. A keeper can be fixed for the whole
// match, in which case they sit outside the rotation.
//
// Pure: no clock, no storage, no Supabase. The live match-day screen keeps its
// own state and calls the helpers at the bottom of this file.

export const SUB_INTERVALS = [6, 8, 10] as const;
export const PITCH_SIZES = [7, 9, 11] as const;

export interface MatchFormat {
  halves: number;
  halfMinutes: number;
  onPitch: number;
}

/** The age number of a group like "U13", or null for anything else. */
export function ageNumber(ageGroup: string | null | undefined): number | null {
  const n = Number(/^U(\d{1,2})$/i.exec((ageGroup ?? "").trim())?.[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The usual match for an age group: U11 2 x 25, U13 2 x 30, U15 and up 2 x 35.
 * U9-U10 play 7-a-side, U11-U12 9-a-side, U13 and up 11-a-side (the same
 * brackets as the board's formations). Unknown groups get the U13 default.
 */
export function defaultFormat(ageGroup: string | null | undefined): MatchFormat {
  const age = ageNumber(ageGroup) ?? 13;
  let halfMinutes = 35;
  if (age <= 11) halfMinutes = 25;
  else if (age <= 14) halfMinutes = 30;
  let onPitch = 11;
  if (age <= 10) onPitch = 7;
  else if (age <= 12) onPitch = 9;
  return { halves: 2, halfMinutes, onPitch };
}

export interface RotationInput {
  /** Available players, in the coach's order: the first ones start. */
  playerIds: string[];
  /** Players on the pitch at once, keeper included. */
  onPitch: number;
  halves: number;
  halfMinutes: number;
  /** Minutes between changes. Every stretch of play is at most this long. */
  intervalMinutes: number;
  /** A keeper who plays the whole match and is never rotated. */
  keeperId?: string | null;
}

export interface RotationSegment {
  /** 1-based half. */
  half: number;
  /** Minutes into the half when this stretch starts. */
  start: number;
  /** Minutes into the half when it ends. */
  end: number;
  /** Who is on the pitch, in the coach's order. */
  lineup: string[];
  /** Who comes off at the start of this stretch (empty for the first). */
  off: string[];
  /** Who goes on at the start of this stretch (empty for the first). */
  on: string[];
}

export interface RotationPlan {
  segments: RotationSegment[];
  /** Planned minutes per player id. */
  minutes: Record<string, number>;
  totalMinutes: number;
  /** The keeper actually used (null if none or not in the squad). */
  keeperId: string | null;
}

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * Split a half into the fewest equal-ish stretches that are each no longer than
 * the interval: 25 minutes at 8 becomes 7, 6, 6, 6. Longer stretches first.
 */
export function splitHalf(halfMinutes: number, intervalMinutes: number): number[] {
  const half = clampInt(halfMinutes, 1, 120);
  const interval = clampInt(intervalMinutes, 1, 120);
  const count = Math.ceil(half / interval);
  const base = Math.floor(half / count);
  const extra = half % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Pick who plays next: the `slots` players with the fewest minutes. Ties keep
 * whoever is already on (fewer changes), then follow the coach's order. Always
 * returns the result in the pool's own order.
 */
export function chooseLineup(
  pool: readonly string[],
  minutes: Readonly<Record<string, number>>,
  current: readonly string[],
  slots: number,
): string[] {
  const onNow = new Set(current);
  const order = new Map(pool.map((id, i) => [id, i]));
  const ranked = [...pool].sort((a, b) => {
    const byMinutes = (minutes[a] ?? 0) - (minutes[b] ?? 0);
    if (byMinutes !== 0) return byMinutes;
    const byOnPitch = Number(onNow.has(b)) - Number(onNow.has(a));
    if (byOnPitch !== 0) return byOnPitch;
    return (order.get(a) ?? 0) - (order.get(b) ?? 0);
  });
  const chosen = new Set(ranked.slice(0, Math.max(0, slots)));
  return pool.filter((id) => chosen.has(id));
}

/** Who comes off and who goes on to get from one line-up to the next. */
export function diffLineups(from: readonly string[], to: readonly string[]): { off: string[]; on: string[] } {
  const next = new Set(to);
  const prev = new Set(from);
  return { off: from.filter((id) => !next.has(id)), on: to.filter((id) => !prev.has(id)) };
}

/** The keeper (if they are in the squad) first, then the rest in order. */
function withKeeper(keeperId: string | null, outfield: string[]): string[] {
  return keeperId ? [keeperId, ...outfield] : outfield;
}

/**
 * Build the whole rotation. Each stretch the outfield places go to the players
 * with the fewest minutes so far, which keeps everyone within one interval of
 * each other by the final whistle. A fixed keeper plays every minute.
 */
export function buildRotation(input: RotationInput): RotationPlan {
  const players = [...new Set(input.playerIds)];
  const keeperId = input.keeperId && players.includes(input.keeperId) ? input.keeperId : null;
  const pool = players.filter((id) => id !== keeperId);
  const onPitch = clampInt(input.onPitch, 1, 11);
  const slots = Math.min(pool.length, Math.max(0, onPitch - (keeperId ? 1 : 0)));
  const halves = clampInt(input.halves, 1, 4);
  const lengths = splitHalf(input.halfMinutes, input.intervalMinutes);

  const minutes: Record<string, number> = Object.fromEntries(players.map((id) => [id, 0]));
  const segments: RotationSegment[] = [];
  let current: string[] = [];

  for (let half = 1; half <= halves; half++) {
    let start = 0;
    for (const length of lengths) {
      const outfield = chooseLineup(pool, minutes, current, slots);
      const { off, on } = segments.length === 0 ? { off: [], on: [] } : diffLineups(current, outfield);
      const lineup = withKeeper(keeperId, outfield);
      for (const id of lineup) minutes[id] += length;
      segments.push({ half, start, end: start + length, lineup, off, on });
      current = outfield;
      start += length;
    }
  }

  const totalMinutes = halves * lengths.reduce((sum, l) => sum + l, 0);
  return { segments, minutes, totalMinutes, keeperId };
}

/** The change points of a plan: every stretch after the first. */
export function changePoints(plan: RotationPlan): { half: number; atSec: number; segmentIndex: number }[] {
  return plan.segments.flatMap((s, i) => (i === 0 ? [] : [{ half: s.half, atSec: s.start * 60, segmentIndex: i }]));
}

// ─────────────────────────────────────────────────────────────────
// Live match: clock and minutes
// ─────────────────────────────────────────────────────────────────

/** One spell on the pitch, in clock seconds (running time, all halves). */
export type Stint = [number, number | null];

export interface LiveClock {
  /** Clock seconds banked before the current run. */
  baseSec: number;
  /** Epoch ms when the clock was last started, or null while paused. */
  runningSince: number | null;
}

/** Total running seconds on the clock right now. */
export function clockSeconds(clock: LiveClock, nowMs: number): number {
  if (clock.runningSince === null) return clock.baseSec;
  return clock.baseSec + Math.max(0, (nowMs - clock.runningSince) / 1000);
}

/** Seconds a player has been on the pitch, counting an open spell up to `nowSec`. */
export function stintSeconds(stints: readonly Stint[] | undefined, nowSec: number): number {
  return (stints ?? []).reduce((sum, [from, to]) => sum + Math.max(0, (to ?? nowSec) - from), 0);
}

/** Whole minutes, rounded to the nearest, for showing and saving. */
export function toMinutes(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60));
}

/**
 * Apply a change at `atSec`: close the spells of those coming off, open new
 * ones for those going on. A player listed in both is left alone, and nobody
 * already on can be put on twice.
 */
export function applyChange(
  stints: Readonly<Record<string, Stint[]>>,
  onPitch: readonly string[],
  change: { off: readonly string[]; on: readonly string[] },
  atSec: number,
): { stints: Record<string, Stint[]>; onPitch: string[] } {
  const both = new Set(change.off.filter((id) => change.on.includes(id)));
  const current = new Set(onPitch);
  const off = change.off.filter((id) => !both.has(id) && current.has(id));
  const on = change.on.filter((id) => !both.has(id) && !current.has(id));
  const next: Record<string, Stint[]> = {};
  for (const [id, list] of Object.entries(stints)) next[id] = list.map((s): Stint => [s[0], s[1]]);
  for (const id of off) {
    const list = next[id] ?? [];
    const last = list.at(-1);
    if (last && last[1] === null) last[1] = atSec;
    next[id] = list;
  }
  for (const id of on) next[id] = [...(next[id] ?? []), [atSec, null]];
  const offSet = new Set(off);
  return { stints: next, onPitch: [...onPitch.filter((id) => !offSet.has(id)), ...on] };
}

/** Close every open spell at `atSec` (final whistle). */
export function closeAll(stints: Readonly<Record<string, Stint[]>>, atSec: number): Record<string, Stint[]> {
  return Object.fromEntries(
    Object.entries(stints).map(([id, list]) => [id, list.map((s): Stint => [s[0], s[1] ?? atSec])]),
  );
}

/**
 * The suggested change at a change point. If the coach has stuck to the plan,
 * follow it. If they have swapped someone, pick afresh from live minutes so the
 * plan bends back towards fair rather than repeating a stale line-up.
 */
export function suggestChange(args: {
  plan: RotationPlan;
  segmentIndex: number;
  onPitch: readonly string[];
  liveSeconds: Readonly<Record<string, number>>;
  squad: readonly string[];
}): { off: string[]; on: string[] } {
  const { plan, segmentIndex, onPitch, liveSeconds, squad } = args;
  const target = plan.segments[segmentIndex];
  const previous = plan.segments[segmentIndex - 1];
  if (!target) return { off: [], on: [] };
  const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));
  if (previous && sameSet(previous.lineup, onPitch)) return diffLineups(onPitch, target.lineup);

  const keeper = plan.keeperId && onPitch.includes(plan.keeperId) ? plan.keeperId : null;
  const pool = squad.filter((id) => id !== keeper);
  const slots = onPitch.length - (keeper ? 1 : 0);
  const outfieldNow = onPitch.filter((id) => id !== keeper);
  const wholeMinutes = Object.fromEntries(pool.map((id) => [id, toMinutes(liveSeconds[id] ?? 0)]));
  const next = chooseLineup(pool, wholeMinutes, outfieldNow, slots);
  return diffLineups(outfieldNow, next);
}

/** "2:14" for a count of seconds (negative counts as zero). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
