// Putting both teams on the full pitch without clashing, and the shapes each
// formation takes when it has the ball and when it hasn't.
//
// Everything is in board space (100 wide x 150 tall). A formation's slots are
// written for the home team, who defend the bottom goal (y = 150) and attack
// up the pitch. The away team is the same shape turned round: (x, y) becomes
// (100 - x, 150 - y).
//
// Pure functions only - no React, no DOM.

import { BOARD_H, BOARD_W, compress } from "@/lib/board-model";
import type { FormationSlot } from "@/lib/formations";

/** "base" is the formation as named (a 4-4-2). "attack" is that team's shape
 * with the ball, "defend" its shape without it. */
export type ShapePhase = "base" | "attack" | "defend";

export interface Spot {
  x: number;
  y: number;
}

/** How far a role moves from its base spot, in board units. `dy` is up the
 * pitch when negative; `in` pulls the player toward the middle, `out` pushes
 * toward the touchline. */
interface Move {
  dy: number;
  in?: number;
  out?: number;
}

// With the ball: full backs and wing backs join the attack, wide midfielders
// tuck in, the attacking midfielder joins the front line.
const ATTACK: Record<string, Move> = {
  gk: { dy: -6 },
  cb: { dy: -12 },
  sw: { dy: -8 },
  lb: { dy: -26, out: 6 },
  rb: { dy: -26, out: 6 },
  lwb: { dy: -20, out: 4 },
  rwb: { dy: -20, out: 4 },
  cdm: { dy: -10 },
  cm: { dy: -14 },
  lm: { dy: -14, in: 8 },
  rm: { dy: -14, in: 8 },
  cam: { dy: -14 },
  lw: { dy: -8, out: 6 },
  rw: { dy: -8, out: 6 },
  ss: { dy: -8 },
  cf: { dy: -8 },
  st: { dy: -8 },
};

// Without the ball: wing backs drop in line with the defence, wingers and
// wide midfielders tuck in and drop to make a bank of four or five, the front
// players come back to halfway.
const DEFEND: Record<string, Move> = {
  gk: { dy: 0 },
  cb: { dy: 6 },
  sw: { dy: 4 },
  lb: { dy: 4, in: 4 },
  rb: { dy: 4, in: 4 },
  lwb: { dy: 22, in: 6 },
  rwb: { dy: 22, in: 6 },
  cdm: { dy: 8 },
  cm: { dy: 10 },
  lm: { dy: 10, in: 6 },
  rm: { dy: 10, in: 6 },
  cam: { dy: 16, in: 6 },
  lw: { dy: 24, in: 14 },
  rw: { dy: 24, in: 14 },
  ss: { dy: 16 },
  cf: { dy: 14 },
  st: { dy: 14 },
};

const GK_ROLES = new Set(["gk", "goalkeeper"]);
const EDGE = 6;
const TOP = 20;
const OUTFIELD_BOTTOM = 136;
const GK_TOP = 128;
const GK_BOTTOM = 146;

/** The closest two players may stand, in board units (about 9 m): a shirt,
 * its number or name, and a little air. */
export const MIN_GAP = 13;

/** A step down the pitch counts this much more than one across it: a gap
 * between lines is a real gap, so the spacing pass nudges sideways first. */
const LENGTH_WEIGHT = 1.4;

/** How far apart two players are, the way the spacing pass measures it. */
export function gapBetween(a: Spot, b: Spot): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * LENGTH_WEIGHT);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** One slot's spot in the home orientation for a phase, kept on the pitch. */
function shifted(slot: FormationSlot, base: Spot, phase: ShapePhase): Spot {
  if (phase === "base") return base;
  const move = (phase === "attack" ? ATTACK : DEFEND)[slot.role] ?? { dy: phase === "attack" ? -10 : 10 };
  const side = base.x < BOARD_W / 2 ? 1 : -1; // +1 = left half, so "in" is toward +x
  const centred = Math.abs(base.x - BOARD_W / 2) < 6;
  let x = base.x;
  if (!centred) x += side * (move.in ?? 0) - side * (move.out ?? 0);
  const y = base.y + move.dy;
  if (GK_ROLES.has(slot.role)) return { x: base.x, y: clamp(y, GK_TOP, GK_BOTTOM) };
  return { x: clamp(x, EDGE, BOARD_W - EDGE), y: clamp(y, TOP, OUTFIELD_BOTTOM) };
}

/** The other team's shape when this one is in `phase`: if we attack they
 * defend, and the other way round. */
export function opposite(phase: ShapePhase): ShapePhase {
  if (phase === "attack") return "defend";
  if (phase === "defend") return "attack";
  return "base";
}

/** Nudge one pair that stands too close apart, sideways first. A fixed
 * player stays put and the other takes the whole move. Returns whether the
 * pair needed moving. */
function pushApart(a: Spot, b: Spot, index: number, aFixed: boolean, bFixed: boolean, min: number): boolean {
  const dist = gapBetween(a, b);
  if (dist >= min) return false;
  const need = min - dist;
  // Two players on the very same spot go opposite ways, alternating by pair.
  let ux = index % 2 === 0 ? 1 : -1;
  let uy = 0;
  if (dist > 0) {
    ux = (b.x - a.x) / dist;
    uy = ((b.y - a.y) * LENGTH_WEIGHT) / dist;
  }
  let shareA = 0.5;
  let shareB = 0.5;
  if (bFixed) { shareA = 1; shareB = 0; }
  if (aFixed) { shareA = 0; shareB = 1; }
  a.x -= ux * need * shareA;
  a.y -= (uy * need * shareA) / LENGTH_WEIGHT;
  b.x += ux * need * shareB;
  b.y += (uy * need * shareB) / LENGTH_WEIGHT;
  return true;
}

/** Move players that stand too close apart, sideways first, so a line stays a
 * line. The goalkeepers do not move. Deterministic: the same input always
 * gives the same spots. */
export function separate(spots: readonly Spot[], fixed: ReadonlySet<number> = new Set(), min = MIN_GAP): Spot[] {
  const out = spots.map((s) => ({ ...s }));
  for (let pass = 0; pass < 120; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (pushApart(out[i], out[j], i, fixed.has(i), fixed.has(j), min)) moved = true;
      }
    }
    for (let i = 0; i < out.length; i++) {
      if (fixed.has(i)) continue;
      out[i].x = clamp(out[i].x, EDGE, BOARD_W - EDGE);
      out[i].y = clamp(out[i].y, 2, BOARD_H - 2);
    }
    if (!moved) break;
  }
  return out;
}

export interface TeamSpots {
  home: Spot[];
  away: Spot[];
}

/**
 * Both teams (or just one) on the full pitch for a phase of play.
 *
 * `phase` is the home team's. The away team squeezes its formation into its
 * own half (the home team does too once there is an opponent), takes its shape for the phase, and a
 * spacing pass then keeps every player a clear step from every other, so
 * a 2-3-1 against a 4-4-2 shows its true shape instead of piling up at
 * halfway. A lone home team uses the whole pitch as the formation was drawn.
 */
export function layoutTeams(
  home: readonly FormationSlot[] | null,
  away: readonly FormationSlot[] | null,
  phase: ShapePhase = "base"
): TeamSpots {
  const both = Boolean(home && away);
  const homeSpots = (home ?? []).map((slot) => {
    const base = both ? compress(slot, "home") : { x: slot.x, y: slot.y };
    return shifted(slot, base, phase);
  });
  const awayPhase = opposite(phase);
  const awaySpots = (away ?? []).map((slot) => {
    // Shift in the home orientation, then turn the pitch round.
    const s = shifted(slot, mirrorBack(compress(slot, "away")), awayPhase);
    return mirrorBack(s);
  });
  if (!both) return { home: homeSpots, away: awaySpots };

  const all = [...homeSpots, ...awaySpots];
  const fixed = new Set<number>();
  [...(home ?? []), ...(away ?? [])].forEach((slot, i) => {
    if (GK_ROLES.has(slot.role)) fixed.add(i);
  });
  const placed = separate(all, fixed);
  return { home: placed.slice(0, homeSpots.length), away: placed.slice(homeSpots.length) };
}

/** compress(slot, "away") is already turned round; bring it back to the home
 * orientation so a phase shift can be applied the same way for both teams. */
function mirrorBack(s: Spot): Spot {
  return { x: BOARD_W - s.x, y: BOARD_H - s.y };
}
