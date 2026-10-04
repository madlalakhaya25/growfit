// The live match-day state for the playing-time screen: a match clock that
// survives a reload (it is just numbers, kept in localStorage by the page),
// who is on the pitch, and each child's spells on it. Pure functions only; the
// page owns the timer and storage.

import {
  applyChange,
  buildRotation,
  changePoints,
  clockSeconds,
  closeAll,
  stintSeconds,
  suggestChange,
  toMinutes,
  type LiveClock,
  type RotationInput,
  type RotationPlan,
  type Stint,
} from "./playing-time";

export type LivePhase = "ready" | "playing" | "break" | "done";
export type Change = { off: string[]; on: string[] };

export interface LiveConfig extends RotationInput {
  keeperId: string | null;
}

interface LiveCore {
  v: 1;
  config: LiveConfig;
  phase: LivePhase;
  /** 1-based half currently being played (or just finished, during a break). */
  half: number;
  /** Clock seconds when the current half kicked off. */
  halfStartSec: number;
  clock: LiveClock;
  stints: Record<string, Stint[]>;
  onPitch: string[];
  /** Index into changePoints(plan) of the next change to make. */
  nextPoint: number;
}

export interface LiveState extends LiveCore {
  /** The state before the last confirmed change, for a one-step undo. */
  undo: LiveCore | null;
}

/** A change within this long of its planned time counts as that change. */
const EARLY_WINDOW_SEC = 90;

export function storageKey(fixtureId: string): string {
  return `growfit:minutes:${fixtureId}`;
}

/** A fresh match: the plan's first line-up is on, the clock is at zero and stopped. */
export function createLiveState(config: LiveConfig): LiveState {
  const plan = buildRotation(config);
  const starters = plan.segments[0]?.lineup ?? [];
  return {
    v: 1,
    config,
    phase: "ready",
    half: 1,
    halfStartSec: 0,
    clock: { baseSec: 0, runningSince: null },
    stints: Object.fromEntries(starters.map((id) => [id, [[0, null] as Stint]])),
    onPitch: starters,
    nextPoint: 0,
    undo: null,
  };
}

export function isRunning(s: LiveState): boolean {
  return s.clock.runningSince !== null;
}

/** Seconds into the current half. */
export function halfSeconds(s: LiveState, nowMs: number): number {
  return Math.max(0, clockSeconds(s.clock, nowMs) - s.halfStartSec);
}

function pause(clock: LiveClock, nowMs: number): LiveClock {
  return { baseSec: clockSeconds(clock, nowMs), runningSince: null };
}

export function startClock(s: LiveState, nowMs: number): LiveState {
  if (s.phase === "done" || s.phase === "break" || isRunning(s)) return s;
  return { ...s, phase: "playing", clock: { baseSec: s.clock.baseSec, runningSince: nowMs } };
}

export function pauseClock(s: LiveState, nowMs: number): LiveState {
  if (!isRunning(s)) return s;
  return { ...s, clock: pause(s.clock, nowMs) };
}

/** Where the match is, for deciding which change points are behind us. */
function position(s: LiveState, nowMs: number): { half: number; sec: number } {
  if (s.phase === "break") return { half: s.half + 1, sec: 0 };
  return { half: s.half, sec: halfSeconds(s, nowMs) };
}

function isAtOrBefore(p: { half: number; atSec: number }, pos: { half: number; sec: number }, slack = 0): boolean {
  return p.half < pos.half || (p.half === pos.half && p.atSec <= pos.sec + slack);
}

function skipPassed(plan: RotationPlan, from: number, pos: { half: number; sec: number }, slack = 0): number {
  const points = changePoints(plan);
  let i = from;
  while (i < points.length && isAtOrBefore(points[i], pos, slack)) i++;
  return i;
}

/** End the half: stop the clock; after the last half the match is done. */
export function endHalf(s: LiveState, nowMs: number): LiveState {
  if (s.phase !== "playing") return s;
  const clock = pause(s.clock, nowMs);
  if (s.half >= s.config.halves) {
    return { ...s, phase: "done", clock, stints: closeAll(s.stints, clock.baseSec), undo: null };
  }
  return { ...s, phase: "break", clock };
}

export function startNextHalf(s: LiveState, nowMs: number, plan: RotationPlan): LiveState {
  if (s.phase !== "break") return s;
  const half = s.half + 1;
  const nextPoint = skipPassed(plan, s.nextPoint, { half, sec: -1 });
  return {
    ...s,
    phase: "playing",
    half,
    halfStartSec: s.clock.baseSec,
    clock: { baseSec: s.clock.baseSec, runningSince: nowMs },
    nextPoint,
    undo: null,
  };
}

/** Blow the final whistle early (or at the end). */
export function finishMatch(s: LiveState, nowMs: number): LiveState {
  if (s.phase === "done") return s;
  const clock = pause(s.clock, nowMs);
  return { ...s, phase: "done", clock, stints: closeAll(s.stints, clock.baseSec), undo: null };
}

export interface NextChangeInfo {
  /** Index of the stretch this change starts, or null when none are left this half. */
  segmentIndex: number | null;
  /** Seconds until it is due (0 or less once due); null when there is no countdown. */
  secondsUntil: number | null;
  due: boolean;
  atHalfTime: boolean;
}

/** The next planned change and how long until it. */
export function nextChange(s: LiveState, plan: RotationPlan, nowMs: number): NextChangeInfo {
  const none = { segmentIndex: null, secondsUntil: null, due: false, atHalfTime: false };
  const point = changePoints(plan)[s.nextPoint];
  if (!point || s.phase === "done" || s.phase === "ready") return none;
  if (s.phase === "break") {
    const atHalfTime = point.half === s.half + 1 && point.atSec === 0;
    return atHalfTime ? { segmentIndex: point.segmentIndex, secondsUntil: null, due: true, atHalfTime } : none;
  }
  if (point.half !== s.half) return none;
  const secondsUntil = point.atSec - halfSeconds(s, nowMs);
  return { segmentIndex: point.segmentIndex, secondsUntil, due: secondsUntil <= 0, atHalfTime: false };
}

/** Each squad player's seconds on the pitch so far. */
export function liveSeconds(s: LiveState, nowMs: number): Record<string, number> {
  const now = clockSeconds(s.clock, nowMs);
  return Object.fromEntries(s.config.playerIds.map((id) => [id, stintSeconds(s.stints[id], now)]));
}

/** The change the screen should offer for the next change point. */
export function suggestedChange(s: LiveState, plan: RotationPlan, nowMs: number): Change {
  const info = nextChange(s, plan, nowMs);
  if (info.segmentIndex === null) return { off: [], on: [] };
  return suggestChange({
    plan,
    segmentIndex: info.segmentIndex,
    onPitch: s.onPitch,
    liveSeconds: liveSeconds(s, nowMs),
    squad: s.config.playerIds,
  });
}

function core(s: LiveState): LiveCore {
  const { undo: _undo, ...rest } = s;
  return rest;
}

/**
 * Make a change now. If it is due (or nearly), it counts as the planned change
 * and the countdown moves on; a change mid-stretch (an injury, say) leaves the
 * next planned change where it is.
 */
export function confirmChange(s: LiveState, change: Change, plan: RotationPlan, nowMs: number): LiveState {
  if (s.phase === "done" || change.off.length !== change.on.length || change.off.length === 0) return s;
  const atSec = clockSeconds(s.clock, nowMs);
  const applied = applyChange(s.stints, s.onPitch, change, atSec);
  const nextPoint = skipPassed(plan, s.nextPoint, position(s, nowMs), EARLY_WINDOW_SEC);
  return { ...s, ...applied, nextPoint, undo: core(s) };
}

/** Let the next planned change go by without making it. */
export function skipChange(s: LiveState, plan: RotationPlan): LiveState {
  return s.nextPoint < changePoints(plan).length ? { ...s, nextPoint: s.nextPoint + 1 } : s;
}

export function undoChange(s: LiveState): LiveState {
  return s.undo ? { ...s.undo, undo: null } : s;
}

/** Whole minutes per player, for saving at the end. */
export function finalMinutes(s: LiveState, nowMs: number): { playerId: string; minutes: number }[] {
  const secs = liveSeconds(s, nowMs);
  return s.config.playerIds.map((id) => ({ playerId: id, minutes: toMinutes(secs[id] ?? 0) }));
}

const PHASES: readonly LivePhase[] = ["ready", "playing", "break", "done"];
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStint = (v: unknown): v is Stint =>
  Array.isArray(v) && v.length === 2 && isNum(v[0]) && (v[1] === null || isNum(v[1]));

function validConfig(c: unknown): c is LiveConfig {
  if (!c || typeof c !== "object") return false;
  const r = c as Record<string, unknown>;
  return (
    isStrings(r.playerIds) && isNum(r.onPitch) && isNum(r.halves) && isNum(r.halfMinutes) &&
    isNum(r.intervalMinutes) && (r.keeperId === null || typeof r.keeperId === "string")
  );
}

function validStints(v: unknown): v is Record<string, Stint[]> {
  return !!v && typeof v === "object" && Object.values(v).every((list) => Array.isArray(list) && list.every(isStint));
}

function validCore(v: unknown): v is LiveCore {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const clock = r.clock as Record<string, unknown> | undefined;
  return (
    r.v === 1 && validConfig(r.config) && PHASES.includes(r.phase as LivePhase) &&
    isNum(r.half) && isNum(r.halfStartSec) && isNum(r.nextPoint) && isStrings(r.onPitch) &&
    !!clock && isNum(clock.baseSec) && (clock.runningSince === null || isNum(clock.runningSince)) &&
    validStints(r.stints)
  );
}

/** Read a stored match back, or null if it is missing, damaged or from an older version. */
export function parseLiveState(raw: string | null): LiveState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!validCore(v)) return null;
    const undo = validCore(v.undo) ? v.undo : null;
    return { ...(v as unknown as LiveCore), undo };
  } catch {
    return null;
  }
}
