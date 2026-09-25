// Smart coaching tools for the tactics board. Pure functions — no React —
// rendered/wired by tactical-board.tsx and coaching-layers.tsx:
//
//   shiftToBall   — a defending side slides and compacts as a zonal unit as
//                   the ball moves (the "Auto-shift" toggle)
//   reachTimes    — how long each drawn run takes at this age group, and
//                   whether the nearest opponent gets there first
//   pressingPlan  — who presses the ball carrier, who cuts the passing
//                   lanes, who marks — drawn as ordinary arrows
//   playerJobs    — each player's movements as plain-language instructions
//
// Orientation matches the board: we attack toward y=0, the opponent defends
// the top goal. Everything works in the full-pitch 100×150 space.

import {
  ARROW_SHAPE_KINDS, BOARD_H, BOARD_W, outfieldOf, uid,
  type Pitch, type Point, type Shape, type Token,
} from "@/lib/board-model";
import { zoneLabel, zoneOf } from "@/lib/board-analysis";

type T = Pick<Token, "id" | "kind" | "group" | "x" | "y" | "label">;

const clampX = (x: number) => Math.max(3, Math.min(BOARD_W - 3, x));
const clampY = (y: number) => Math.max(3, Math.min(BOARD_H - 3, y));
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

// ── Auto-shift ───────────────────────────────────────────────────

/**
 * Where a defending side should stand for this ball position, given where
 * it stood at rest (`anchors`, captured when Auto-shift was switched on).
 * The textbook zonal picture, simplified:
 *  - the whole block slides across toward the ball's side,
 *  - it narrows as the ball goes wide (the far side is left open, deliberately),
 *  - it steps toward the ball, but never through its own goal line,
 *  - the nearest outfield player goes to press the ball,
 *  - the keeper shades across his goal toward the ball.
 * Anchors, not current positions, are the input, so dragging the ball back
 * to where it was returns the shape to exactly where it started.
 */
export function shiftToBall(
  anchors: T[],
  ball: Point,
  side: "player" | "opponent"
): Map<string, Point> {
  const out = new Map<string, Point>();
  const team = anchors.filter((t) => t.kind === side);
  const outfield = outfieldOf(team, side);
  if (outfield.length === 0) return out;
  const keepers = team.filter((t) => !outfield.includes(t));

  const cx = BOARD_W / 2;
  const cy = outfield.reduce((s, t) => s + t.y, 0) / outfield.length;
  const wide = Math.min(1, Math.abs(ball.x - cx) / (BOARD_W / 2));
  const narrow = 1 - 0.3 * wide;          // 1 → 0.7 as the ball goes to the touchline
  const slide = (ball.x - cx) * 0.5;
  // Step toward the ball, but a defending block only goes so far from home.
  const step = Math.max(-18, Math.min(18, (ball.y - cy) * 0.35));
  // Never let the back line pass its own goal area.
  const deepest = side === "opponent" ? Math.min(...outfield.map((t) => t.y)) : Math.max(...outfield.map((t) => t.y));
  const guard = side === "opponent" ? Math.max(step, 8 - deepest) : Math.min(step, BOARD_H - 8 - deepest);

  for (const t of outfield) {
    out.set(t.id, {
      x: clampX(cx + (t.x - cx) * narrow + slide),
      y: clampY(cy + guard + (t.y - cy) * 0.9),
    });
  }
  for (const k of keepers) {
    out.set(k.id, { x: clampX(cx + (ball.x - cx) * 0.2), y: k.y });
  }

  // The nearest outfield player (after the shift) presses the ball, from
  // the side of his own goal.
  let presser: string | null = null, best = Infinity;
  for (const t of outfield) {
    const d = dist(out.get(t.id)!, ball);
    if (d < best) { best = d; presser = t.id; }
  }
  if (presser && best > 3) {
    const goalSide = side === "opponent" ? -3 : 3;
    out.set(presser, { x: clampX(ball.x), y: clampY(ball.y + goalSide) });
  }
  return out;
}

// ── Reach times ──────────────────────────────────────────────────

/** Typical average speed over a 20–30m run, including the acceleration,
 * by age — not top speed, which a young player reaches only briefly. */
const SPEED_BY_AGE: [number, number][] = [[9, 4.2], [11, 4.6], [13, 5.2], [15, 5.8], [17, 6.3]];
const SENIOR_SPEED = 6.8;
/** The defender has to see it before they go. */
const REACTION_S = 0.3;

export function runSpeedFor(ageGroup: string): number {
  const age = Number.parseInt(/\d+/.exec(ageGroup)?.[0] ?? "", 10);
  if (!Number.isFinite(age)) return SPEED_BY_AGE[3][1];
  return SPEED_BY_AGE.find(([maxAge]) => age <= maxAge)?.[1] ?? SENIOR_SPEED;
}

export interface ReachTime {
  shapeId: string;
  end: Point;
  /** Where to label it: halfway along, clear of the players at either end. */
  mid: Point;
  seconds: number;
  rival: { id: string; label: string; seconds: number } | null;
  /** first: clear of the nearest opponent; contest: within half a second; late: they're there first. */
  verdict: "first" | "contest" | "late";
}

/**
 * For every run, dribble or press a player makes: how long it takes at this
 * age, and whether the nearest player of the other side reaches the same
 * spot first. The mover is the token under the arrow's start (the same rule
 * Play uses to decide who moves).
 */
export function reachTimes(tokens: T[], shapes: Shape[], pitch: Pick<Pitch, "metresPerUnit">, ageGroup: string): ReachTime[] {
  const speed = runSpeedFor(ageGroup);
  const out: ReachTime[] = [];
  for (const sh of shapes) {
    if (sh.kind !== "run" && sh.kind !== "dribble" && sh.kind !== "press") continue;
    const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
    const mover = nearest(tokens.filter((t) => t.kind !== "ball"), a, 10);
    if (!mover) continue;
    const pace = sh.kind === "dribble" ? speed * 0.75 : speed;
    const seconds = (dist(a, b) * pitch.metresPerUnit) / pace;
    const other = mover.kind === "player" ? "opponent" : "player";
    // A run that ends right beside an opponent is going *to* him — to press
    // or mark — so he's the target, not a rival for the spot.
    const rivals = tokens.filter((t) => t.kind === other && dist(t, b) > 4);
    const rivalTok = nearest(rivals, b, Infinity);
    const rival = rivalTok
      ? { id: rivalTok.id, label: rivalTok.label, seconds: REACTION_S + (dist(rivalTok, b) * pitch.metresPerUnit) / speed }
      : null;
    const margin = rival ? rival.seconds - seconds : Infinity;
    out.push({ shapeId: sh.id, end: b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, seconds, rival, verdict: verdictFor(margin) });
  }
  return out;
}

function verdictFor(margin: number): ReachTime["verdict"] {
  if (margin > 0.5) return "first";
  if (margin < -0.5) return "late";
  return "contest";
}

function nearest<U extends Point>(pool: U[], p: Point, maxDist: number): U | null {
  let best: U | null = null, bestD = maxDist;
  for (const t of pool) {
    const d = dist(t, p);
    if (d <= bestD) { bestD = d; best = t; }
  }
  return best;
}

// ── Pressing plan ────────────────────────────────────────────────

/** Opponents further than this from the ball aren't part of the press. */
const PRESS_RADIUS = 35;
/** Nobody is sent further than this (board units, ≈21m) to take a job. */
const MAX_PRESS_RUN = 30;

export interface PressingPlan {
  carrierId: string | null;
  shapes: Shape[];
  /** Who does what, for the notice/legend. */
  roles: { tokenId: string; role: "press" | "cover" | "mark" }[];
}

/**
 * Press the opponent on the ball: the nearest of ours closes the carrier
 * down (a press line), the next two cut the passes to the carrier's two
 * nearest teammates, and up to four more pick up the nearest free
 * opponents goal-side. Everything comes back as ordinary shapes, so the
 * coach can drag, recolour or delete any of it — and Play animates it.
 */
export function pressingPlan(tokens: T[]): PressingPlan {
  const ball = tokens.find((t) => t.kind === "ball");
  const theirs = tokens.filter((t) => t.kind === "opponent");
  const carrier = ball ? nearest(theirs, ball, 7) : null;
  if (!carrier) return { carrierId: null, shapes: [], roles: [] };

  const ours = outfieldOf(tokens.filter((t) => t.kind === "player"), "player");
  const free = [...ours].sort((p, q) => dist(p, carrier) - dist(q, carrier));
  const shapes: Shape[] = [];
  const roles: PressingPlan["roles"] = [];
  const move = (tok: T, to: Point, kind: Shape["kind"], role: PressingPlan["roles"][number]["role"]) => {
    if (dist(tok, to) < 2) return;
    shapes.push({ id: uid("s"), kind, pts: [{ x: tok.x, y: tok.y }, { x: clampX(to.x), y: clampY(to.y) }] });
    roles.push({ tokenId: tok.id, role });
  };

  // 1. Presser: to just short of the carrier, on the line from where he stands.
  const presser = free.shift();
  if (presser) {
    const d = dist(presser, carrier) || 1;
    const stop = Math.max(0, d - 2.5) / d;
    move(presser, { x: presser.x + (carrier.x - presser.x) * stop, y: presser.y + (carrier.y - presser.y) * stop }, "press", "press");
  }

  // A press is local: only opponents near the ball are worth cutting off or
  // marking, and only by players close enough to get there in time — a
  // full-back sprinting 60m to mark their centre-back isn't a press.
  const nearBall = theirs.filter((t) => t.id !== carrier.id && t.group !== "Goalkeeper" && dist(t, carrier) <= PRESS_RADIUS);
  const take = (target: Point) => {
    free.sort((p, q) => dist(p, target) - dist(q, target));
    return free.length && dist(free[0], target) <= MAX_PRESS_RUN ? free.shift()! : null;
  };

  // 2. Cover: cut the passes to his two nearest teammates.
  const outlets = [...nearBall].sort((p, q) => dist(p, carrier) - dist(q, carrier)).slice(0, 2);
  for (const outlet of outlets) {
    const lane = { x: carrier.x + (outlet.x - carrier.x) * 0.45, y: carrier.y + (outlet.y - carrier.y) * 0.45 };
    const coverer = take(lane);
    if (coverer) move(coverer, lane, "run", "cover");
  }

  // 3. Mark: the other nearby opponents, goal-side (between them and our goal).
  const rest = nearBall.filter((t) => !outlets.includes(t)).sort((p, q) => dist(p, carrier) - dist(q, carrier)).slice(0, 4);
  for (const opp of rest) {
    const spot = { x: opp.x, y: opp.y + 3 };
    const marker = take(spot);
    if (marker) move(marker, spot, "run", "mark");
  }
  return { carrierId: carrier.id, shapes, roles };
}

// ── Player jobs ──────────────────────────────────────────────────

export interface PlayerJob {
  tokenId: string;
  label: string;
  side: "player" | "opponent";
  steps: string[];
}

function whereTo(p: Point, fullPitch: boolean): string {
  if (fullPitch) return `the ${zoneLabel(zoneOf(p)).replace(", ", " — ")}`;
  return "the marked spot";
}

/**
 * Turn the drawn arrows into each player's job, in the order they were
 * drawn: "1. Run 18m into the attacking third — left half-space". Uses the
 * same who-moves rule as Play (the token nearest an arrow's start, tracked
 * as earlier arrows move it), so the words match the animation.
 */
export function playerJobs(tokens: T[], shapes: Shape[], pitch: Pick<Pitch, "metresPerUnit" | "supportsFormations">): PlayerJob[] {
  const pos = new Map(tokens.map((t) => [t.id, { x: t.x, y: t.y }]));
  const movers = tokens.filter((t) => t.kind !== "ball");
  const jobs = new Map<string, string[]>();
  const add = (id: string, text: string) => jobs.set(id, [...(jobs.get(id) ?? []), text]);
  const at = (p: Point, maxD: number) => {
    let best: T | null = null, bestD = maxD;
    for (const t of movers) {
      const d = dist(pos.get(t.id)!, p);
      if (d <= bestD) { bestD = d; best = t; }
    }
    return best as T | null;
  };

  shapes.filter((s) => ARROW_SHAPE_KINDS.has(s.kind) && s.pts.length >= 2).forEach((sh, i) => {
    const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
    const who = at(a, 10);
    if (!who) return;
    const metres = Math.round(dist(a, b) * pitch.metresPerUnit);
    const where = whereTo(b, pitch.supportsFormations);
    const step = `${i + 1}.`;
    if (sh.kind === "pass" || sh.kind === "shot") {
      if (sh.kind === "shot") { add(who.id, `${step} Shoot at goal`); return; }
      const target = movers.find((t) => t.id !== who.id && t.kind === who.kind && dist(pos.get(t.id)!, b) <= 8);
      add(who.id, `${step} Pass ${target ? `to ${target.label || "a teammate"}` : `into ${where}`} (${metres}m)`);
      if (target) add(target.id, `${step} Receive the pass from ${who.label || "a teammate"}`);
      return;
    }
    const verb = sh.kind === "dribble" ? "Carry the ball" : sh.kind === "press" ? "Press" : "Run";
    add(who.id, `${step} ${verb} ${metres}m into ${where}`);
    pos.set(who.id, { x: b.x, y: b.y });
  });

  return tokens
    .filter((t) => jobs.has(t.id) && (t.kind === "player" || t.kind === "opponent"))
    .map((t) => ({ tokenId: t.id, label: t.label || (t.kind === "opponent" ? "Opponent" : "Player"), side: t.kind as PlayerJob["side"], steps: jobs.get(t.id)! }));
}
