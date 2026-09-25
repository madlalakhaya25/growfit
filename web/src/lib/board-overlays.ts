// Analysis overlays for the tactics board — Phase 2 of the board roadmap
// (docs/ROADMAP.md). Four questions a coach asks of a shape, each answered
// by pure geometry from whatever tokens are showing:
//
//   passingLanes  — who can the ball carrier pass to, and which lanes are cut?
//   spaceControl  — who owns which grass (nearest player, a sampled Voronoi)?
//   offsideLines  — where is their offside line, is anyone beyond it, and how
//                   compact are both sides' lines?
//   zoneCounts    — us vs them in every zone of the 15-zone grid
//
// No React, no DOM — rendered by components/tactics/analysis-layers.tsx and
// tested directly. Orientation matches the rest of the board: we attack
// upward toward y=0, the opponent defends the top goal.

import { BOARD_H, outfieldOf, type Pitch, type Point, type Token } from "@/lib/board-model";
import { opponentLines, zoneOf, ZONE_IDS, THIRD_EDGES, type ZoneId } from "@/lib/board-analysis";

type T = Pick<Token, "id" | "kind" | "group" | "x" | "y">;

// ── Passing lanes ────────────────────────────────────────────────

export type LaneStatus = "open" | "risky" | "blocked";
export interface PassingLane {
  toId: string;
  from: Point;
  to: Point;
  status: LaneStatus;
  lengthM: number;
  /** The pass gains ground toward their goal. */
  forward: boolean;
}

/** Our player this close to the ball is on it. */
const CARRIER_RADIUS = 6;
/** An opponent this close to the line of a pass cuts it out… */
const BLOCK_DIST = 3.5;
/** …and this close makes it a risk. */
const RISK_DIST = 6;

/** Distance from p to segment a–b, or null when p's projection falls
 * outside the segment (an opponent behind the passer or beyond the
 * receiver isn't in the lane). */
function distToSegment(p: Point, a: Point, b: Point): number | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  if (t <= 0 || t >= 1) return null;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function passingLanes(
  tokens: T[],
  pitch: Pick<Pitch, "metresPerUnit">
): { carrierId: string | null; lanes: PassingLane[] } {
  const ball = tokens.find((t) => t.kind === "ball");
  if (!ball) return { carrierId: null, lanes: [] };
  const ours = tokens.filter((t) => t.kind === "player");
  const carrier = ours
    .map((t) => ({ t, d: Math.hypot(t.x - ball.x, t.y - ball.y) }))
    .filter((c) => c.d <= CARRIER_RADIUS)
    .sort((a, b) => a.d - b.d)[0]?.t;
  if (!carrier) return { carrierId: null, lanes: [] };

  const theirs = tokens.filter((t) => t.kind === "opponent");
  const lanes = ours
    .filter((t) => t.id !== carrier.id && t.group !== "Goalkeeper")
    .map((t) => {
      const closest = theirs.reduce<number>((m, o) => {
        const d = distToSegment(o, carrier, t);
        return d === null ? m : Math.min(m, d);
      }, Infinity);
      const status: LaneStatus = closest < BLOCK_DIST ? "blocked" : closest < RISK_DIST ? "risky" : "open";
      return {
        toId: t.id,
        from: { x: carrier.x, y: carrier.y },
        to: { x: t.x, y: t.y },
        status,
        lengthM: Math.hypot(t.x - carrier.x, t.y - carrier.y) * pitch.metresPerUnit,
        forward: t.y < carrier.y - 2,
      };
    });
  return { carrierId: carrier.id, lanes };
}

// ── Space control ────────────────────────────────────────────────

export interface ControlRun {
  y: number;
  x1: number;
  x2: number;
  side: "player" | "opponent";
}
export interface SpaceControl {
  /** Row height of each run, board units. */
  cellH: number;
  runs: ControlRun[];
  /** Our share of the pitch, 0–100. */
  oursPct: number;
  /** Our share of each third: attacking (their end), middle, defensive. */
  thirdsPct: [number, number, number];
}

/**
 * Who owns each patch of grass — the nearest player to it, a Voronoi
 * diagram sampled on a grid rather than computed exactly, which is plenty
 * at pitch-diagram resolution and needs no geometry library. Keepers count
 * (they own their box); the ball doesn't. Each row's cells are merged into
 * runs so the SVG draws a few hundred rects, not thousands.
 */
export function spaceControl(tokens: T[], pitch: Pick<Pitch, "w" | "h">, cell = 2.5): SpaceControl | null {
  const players = tokens.filter((t) => t.kind === "player" || t.kind === "opponent");
  if (!players.some((t) => t.kind === "player") || !players.some((t) => t.kind === "opponent")) return null;

  const runs: ControlRun[] = [];
  const thirdOurs = [0, 0, 0], thirdAll = [0, 0, 0];
  let ours = 0, all = 0;
  // Cells sized to divide the playing area exactly, so a mirrored position
  // really does come out 50/50 instead of losing a sliver of edge column.
  const cols = Math.max(1, Math.round((pitch.w - 4) / cell)), rows = Math.max(1, Math.round((pitch.h - 4) / cell));
  const cw = (pitch.w - 4) / cols, ch = (pitch.h - 4) / rows;
  for (let r = 0; r < rows; r++) {
    const y = 2 + r * ch, cy = y + ch / 2;
    const ti = cy < THIRD_EDGES[1] ? 0 : cy < THIRD_EDGES[2] ? 1 : 2;
    let run: ControlRun | null = null;
    for (let c = 0; c < cols; c++) {
      const x = 2 + c * cw, cx = x + cw / 2;
      let best = players[0], bestD = Infinity;
      for (const p of players) {
        const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
        if (d < bestD) { bestD = d; best = p; }
      }
      const side = best.kind as ControlRun["side"];
      all++; thirdAll[ti]++;
      if (side === "player") { ours++; thirdOurs[ti]++; }
      if (run && run.side === side) run.x2 = x + cw;
      else { run = { y, x1: x, x2: x + cw, side }; runs.push(run); }
    }
  }
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return {
    cellH: ch, runs,
    oursPct: pct(ours, all),
    thirdsPct: [pct(thirdOurs[0], thirdAll[0]), pct(thirdOurs[1], thirdAll[1]), pct(thirdOurs[2], thirdAll[2])],
  };
}

// ── Offside & lines ──────────────────────────────────────────────

export interface LinesReading {
  /** Their offside line (y), or null with fewer than two opponents. */
  offsideY: number | null;
  /** Ids of our players currently beyond it. */
  offsideIds: string[];
  /** Our last outfield defender's depth, or null with nobody back. */
  ourLastLineY: number | null;
  /** Gaps between consecutive lines, back to front, in metres. */
  theirGapsM: number[];
  ourGapsM: number[];
}

/**
 * Offside, as the law reads it: a player is offside if they're in the
 * opponent's half and nearer the goal line than both the ball and the
 * second-last opponent (keeper included). So the line is whichever of those
 * two is further forward, and never deeper than halfway. Level is onside.
 */
export function offsideLines(tokens: T[], pitch: Pick<Pitch, "metresPerUnit">): LinesReading {
  const theirs = tokens.filter((t) => t.kind === "opponent").sort((a, b) => a.y - b.y);
  const ball = tokens.find((t) => t.kind === "ball");
  const halfway = BOARD_H / 2;

  let offsideY: number | null = null;
  if (theirs.length >= 2) {
    offsideY = Math.min(theirs[1].y, halfway);
    if (ball) offsideY = Math.min(offsideY, ball.y);
  }
  const ours = tokens.filter((t) => t.kind === "player");
  const offsideIds = offsideY === null ? [] : ours.filter((t) => t.y < offsideY! - 0.25).map((t) => t.id);

  const outfield = outfieldOf(tokens, "player");
  const ourLastLineY = outfield.length ? Math.max(...outfield.map((t) => t.y)) : null;

  const gaps = (ys: number[]) => ys.slice(1).map((y, i) => Math.abs(y - ys[i]) * pitch.metresPerUnit);
  const theirYs = opponentLines(tokens).map((l) => l.y);
  // Our units back to front — the same Defender/Midfielder/Forward groups
  // teamShape() links, taken at each unit's mean depth.
  const ourYs = (["Defender", "Midfielder", "Forward"] as const)
    .map((g) => outfield.filter((t) => t.group === g))
    .filter((u) => u.length > 0)
    .map((u) => u.reduce((s, t) => s + t.y, 0) / u.length);

  return { offsideY, offsideIds, ourLastLineY, theirGapsM: gaps(theirYs), ourGapsM: gaps(ourYs) };
}

// ── Numbers per zone ─────────────────────────────────────────────

export interface ZoneCount {
  zoneId: ZoneId;
  us: number;
  them: number;
}

/** Outfield players per zone, us vs them — only zones someone is in. */
export function zoneCounts(tokens: T[]): ZoneCount[] {
  const tally = new Map<ZoneId, ZoneCount>();
  const add = (t: Point, side: "us" | "them") => {
    const z = zoneOf(t);
    const c = tally.get(z) ?? { zoneId: z, us: 0, them: 0 };
    c[side]++;
    tally.set(z, c);
  };
  outfieldOf(tokens, "player").forEach((t) => add(t, "us"));
  outfieldOf(tokens, "opponent").forEach((t) => add(t, "them"));
  return ZONE_IDS.flatMap((z) => (tally.has(z) ? [tally.get(z)!] : []));
}
