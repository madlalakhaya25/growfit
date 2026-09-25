// Reading an opponent's shape off the board — where the space is.
//
// Pure geometry, no AI and no React: given the tokens a coach has placed, find
// the gaps an opponent's shape leaves open (between their lines, behind a
// high line, down a flank nobody covers, in a stretched back line) and where
// we already outnumber them. The board draws these as a live overlay
// (components/tactics/exploit-layer.tsx), and the same findings are handed to
// the AI counter (actions/tactics.ts analyseOpponent) so its advice is built
// on what is actually on the pitch rather than on a formation name.
//
// Orientation matches the rest of the board: we attack upward toward y=0,
// the opponent defends the top goal. "Left" and "right" are always OUR left
// and right as we attack, which is how a coach talks to their own players.
// Opponent tokens carry no position, so everything here is inferred from
// where they stand.

import { BOARD_H, outfieldOf, type Pitch, type Point, type Token } from "@/lib/board-model";

// ── Zone grid ────────────────────────────────────────────────────
//
// 3 thirds × 5 lanes. Lane edges are the same ones the board's "Channels &
// half-spaces" overlay draws, and the thirds are the "Thirds" overlay's, so
// a zone named here is a zone the coach can already see on the pitch.

export const LANE_EDGES = [2, 21, 38, 62, 79, 98] as const;
export const LANE_IDS = ["LW", "LHS", "C", "RHS", "RW"] as const;
export type LaneId = (typeof LANE_IDS)[number];

const THIRD_H = (BOARD_H - 4) / 3;
export const THIRD_EDGES = [2, 2 + THIRD_H, 2 + 2 * THIRD_H, BOARD_H - 2] as const;
/** A = attacking third (their end), M = middle, D = defensive (our end). */
export const THIRD_IDS = ["A", "M", "D"] as const;
export type ThirdId = (typeof THIRD_IDS)[number];

export type ZoneId = `${ThirdId}-${LaneId}`;
export const ZONE_IDS: ZoneId[] = THIRD_IDS.flatMap((t) => LANE_IDS.map((l) => `${t}-${l}` as ZoneId));

const LANE_NAMES: Record<LaneId, string> = {
  LW: "left wing", LHS: "left half-space", C: "centre", RHS: "right half-space", RW: "right wing",
};
const THIRD_NAMES: Record<ThirdId, string> = { A: "attacking third", M: "middle third", D: "defensive third" };

export function isZoneId(id: string): id is ZoneId {
  return (ZONE_IDS as string[]).includes(id);
}

export function zoneLabel(id: ZoneId): string {
  const [t, l] = id.split("-") as [ThirdId, LaneId];
  return `${THIRD_NAMES[t]}, ${LANE_NAMES[l]}`;
}

export function zoneRect(id: ZoneId): { x: number; y: number; w: number; h: number } {
  const [t, l] = id.split("-") as [ThirdId, LaneId];
  const li = LANE_IDS.indexOf(l), ti = THIRD_IDS.indexOf(t);
  return {
    x: LANE_EDGES[li], y: THIRD_EDGES[ti],
    w: LANE_EDGES[li + 1] - LANE_EDGES[li], h: THIRD_EDGES[ti + 1] - THIRD_EDGES[ti],
  };
}

export function zoneCentre(id: ZoneId): Point {
  const r = zoneRect(id);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** The zone a point falls in; points off the edge count as the nearest zone. */
export function zoneOf(p: Point): ZoneId {
  const li = LANE_EDGES.slice(1, 5).filter((e) => p.x >= e).length;
  const ti = THIRD_EDGES.slice(1, 3).filter((e) => p.y >= e).length;
  return `${THIRD_IDS[ti]}-${LANE_IDS[li]}`;
}

/** A zone's rectangle as a closed polygon, for drawing. */
export function rectPolygon(r: { x: number; y: number; w: number; h: number }): Point[] {
  return [
    { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
  ];
}

// ── Opponent lines ───────────────────────────────────────────────

export interface OpponentLine {
  /** Mean depth of the line (smaller = nearer their own goal). */
  y: number;
  /** The line's players, left to right (our left). */
  players: Point[];
}

/** Two opponents further apart than this, front to back, are in different lines. */
const LINE_SPLIT = 7;
const MAX_LINES = 4;

/**
 * Split the opponent's outfield into lines — back line first — by walking
 * them from their goal outward and starting a new line at every big step in
 * depth. More than four is merged down (closest pair first): nobody coaches
 * a 1-1-2-3-1, and a slightly staggered midfield is still one midfield.
 */
export function opponentLines(tokens: Pick<Token, "kind" | "group" | "x" | "y">[]): OpponentLine[] {
  const outfield = outfieldOf(tokens, "opponent").map(({ x, y }) => ({ x, y })).sort((a, b) => a.y - b.y);
  if (outfield.length === 0) return [];

  const groups: Point[][] = [[outfield[0]]];
  for (let i = 1; i < outfield.length; i++) {
    if (outfield[i].y - outfield[i - 1].y > LINE_SPLIT) groups.push([]);
    groups[groups.length - 1].push(outfield[i]);
  }
  const meanY = (g: Point[]) => g.reduce((s, p) => s + p.y, 0) / g.length;
  while (groups.length > MAX_LINES) {
    let best = 0;
    for (let i = 1; i < groups.length - 1; i++) {
      if (meanY(groups[i + 1]) - meanY(groups[i]) < meanY(groups[best + 1]) - meanY(groups[best])) best = i;
    }
    groups.splice(best, 2, [...groups[best], ...groups[best + 1]]);
  }
  return groups.map((g) => ({ y: meanY(g), players: [...g].sort((a, b) => a.x - b.x) }));
}

// ── Exploits ─────────────────────────────────────────────────────

export type ExploitKind = "between-lines" | "behind-line" | "gap-in-line" | "wide" | "overload" | "outnumbered" | "ai-target";

export interface Exploit {
  id: string;
  kind: ExploitKind;
  /** Short headline, e.g. "Pocket between their defence and midfield". */
  label: string;
  /** One or two sentences a coach could say to a player. */
  detail: string;
  /** Area to shade, in board units. */
  polygon: Point[];
  /** 3 = the first thing to go after. */
  severity: 1 | 2 | 3;
  /** Suggested movement into the space: [from, to]. */
  arrow?: [Point, Point];
  /** The grid zone the space sits in — what the AI counter refers back to. */
  zoneId: ZoneId;
  /** "engine" = read off the geometry here; "ai" = suggested by the AI counter. */
  source: "engine" | "ai";
}

export interface OpponentReading {
  lines: OpponentLine[];
  exploits: Exploit[];
}

const MAX_EXPLOITS = 6;
const clampY = (y: number) => Math.max(3, Math.min(BOARD_H - 3, y));
const laneMid = (li: number) => (LANE_EDGES[li] + LANE_EDGES[li + 1]) / 2;
const rect = (x1: number, y1: number, x2: number, y2: number) =>
  rectPolygon({ x: x1, y: clampY(y1), w: x2 - x1, h: clampY(y2) - clampY(y1) });

function severityFor(value: number, thresholds: [number, number, number]): 0 | 1 | 2 | 3 {
  if (value >= thresholds[2]) return 3;
  if (value >= thresholds[1]) return 2;
  if (value >= thresholds[0]) return 1;
  return 0;
}

/**
 * Read the opponent's shape and list the spaces it leaves, most promising
 * first. Empty unless the pitch is a full match pitch (a training grid has
 * no "their goal") and there are at least three opponents to read.
 */
export function readOpponent(
  tokens: Pick<Token, "kind" | "group" | "x" | "y">[],
  pitch: Pick<Pitch, "metresPerUnit" | "supportsFormations">
): OpponentReading {
  if (!pitch.supportsFormations) return { lines: [], exploits: [] };
  const lines = opponentLines(tokens);
  const theirs = lines.flatMap((l) => l.players);
  if (theirs.length < 3) return { lines, exploits: [] };

  const m = (units: number) => units * pitch.metresPerUnit;
  const found: Omit<Exploit, "id" | "source">[] = [];
  const back = lines[0];

  // 1. Space between their lines — the pocket a No.10 or a winger coming
  //    inside wants to receive in, facing their back line.
  //    The midfield-to-front gap is capped low: with both XIs set up each
  //    side is squeezed into its own half, so their strikers always sit on
  //    halfway with room behind them — real, but never the headline.
  const pairs: [number, string, string, 1 | 3][] = [
    [0, "Pocket between their defence and midfield", "Drop a forward or push a midfielder into this pocket to receive on the half-turn — their defenders have to step out or let them turn.", 3],
    [1, "Room between their midfield and front line", "Our midfielders can receive here unpressed — build through this gap before they close it.", 1],
  ];
  for (const [i, label, detail, cap] of pairs) {
    if (lines.length < i + 2) continue;
    const top = lines[i].y, bottom = lines[i + 1].y;
    const gapM = m(bottom - top);
    const sev = Math.min(cap, severityFor(gapM, [11, 15, 20]));
    if (sev === 0) continue;
    // Aim the arrow down whichever central lane is emptiest in that band.
    const inBand = theirs.filter((p) => p.y > top - 3 && p.y < bottom + 3);
    const li = [1, 2, 3].reduce((best, l) => {
      const count = (k: number) => inBand.filter((p) => p.x >= LANE_EDGES[k] && p.x < LANE_EDGES[k + 1]).length;
      return count(l) < count(best) ? l : best;
    }, 2);
    const to = { x: laneMid(li), y: (top + bottom) / 2 };
    found.push({
      kind: "between-lines", label: `${label} (${Math.round(gapM)}m)`, detail,
      polygon: rect(LANE_EDGES[1], top + 2, LANE_EDGES[4], bottom - 2),
      severity: sev as 1 | 2 | 3,
      arrow: [{ x: to.x, y: clampY(bottom + 8) }, to],
      zoneId: zoneOf(to),
    });
  }

  // 2. Space in behind a high back line.
  const behindM = m(back.y - 2);
  const behindSev = severityFor(behindM, [20, 25, 30]);
  if (behindSev > 0 && back.players.length >= 2) {
    const to = { x: 50, y: back.y - Math.min(14, (back.y - 2) / 2) };
    found.push({
      kind: "behind-line", label: `High line — ${Math.round(behindM)}m of space in behind`,
      detail: "Their back line is pushed up. Time runs off the shoulder of the last defender and play the ball over or through early.",
      polygon: rect(LANE_EDGES[1], 3, LANE_EDGES[4], back.y - 3),
      severity: behindSev as 1 | 2 | 3,
      arrow: [{ x: 38, y: clampY(back.y + 8) }, to],
      zoneId: zoneOf(to),
    });
  }

  // 3. Holes inside a line — a back line or midfield stretched too far apart.
  const lineGaps: [number, string, number][] = [[0, "back line", 26], [1, "midfield", 30]];
  for (const [i, name, minUnits] of lineGaps) {
    const line = lines[i];
    if (!line || line.players.length < 2) continue;
    for (let k = 1; k < line.players.length; k++) {
      const a = line.players[k - 1], b = line.players[k];
      const gap = b.x - a.x;
      if (gap < minUnits) continue;
      const mid = { x: (a.x + b.x) / 2, y: line.y };
      found.push({
        kind: "gap-in-line", label: `Gap in their ${name} (${Math.round(m(gap))}m)`,
        detail: i === 0
          ? "Two of their defenders are too far apart. A run between them — or a pass split through them — goes straight at goal."
          : "Their midfield is split. Carry the ball or play through the gap to break a line in one action.",
        polygon: rect(a.x + 3, line.y - 8, b.x - 3, line.y + 8),
        severity: gap >= minUnits + 8 ? 3 : 2,
        arrow: [{ x: mid.x, y: clampY(line.y + 14) }, { x: mid.x, y: clampY(line.y - 8) }],
        zoneId: zoneOf(mid),
      });
    }
  }

  // 4. The flanks — nobody wide at all, or a back line too narrow to cover the wing.
  const flanks: { side: string; li: 0 | 4; covered: (p: Point) => boolean; outside: (x: number) => boolean }[] = [
    { side: "left", li: 0, covered: (p) => p.x < LANE_EDGES[1], outside: (x) => x > LANE_EDGES[1] },
    { side: "right", li: 4, covered: (p) => p.x >= LANE_EDGES[4], outside: (x) => x < LANE_EDGES[4] },
  ];
  for (const f of flanks) {
    const x1 = LANE_EDGES[f.li], x2 = LANE_EDGES[f.li + 1], cx = laneMid(f.li);
    if (!theirs.some(f.covered)) {
      found.push({
        kind: "wide", label: `Our ${f.side} flank is unguarded`,
        detail: `Nobody in their shape is stationed wide on our ${f.side}. Get a winger or overlapping full-back high and wide there and switch play to them.`,
        polygon: rect(x1, 3, x2, THIRD_EDGES[2]),
        severity: 3,
        arrow: [{ x: cx, y: clampY(THIRD_EDGES[2] - 4) }, { x: cx, y: clampY(back.y) }],
        zoneId: zoneOf({ x: cx, y: back.y }),
      });
      continue;
    }
    // Only a back line of three or more has a meaningful "widest" player.
    if (back.players.length < 3) continue;
    const edge = f.li === 0 ? back.players[0].x : back.players[back.players.length - 1].x;
    if (f.outside(edge)) {
      found.push({
        kind: "wide", label: `Space outside their back line on our ${f.side}`,
        detail: "Their back line doesn't cover the width. A wide runner here gets in behind their wide player and can cross or cut back.",
        polygon: rect(x1, back.y - 10, x2, back.y + 12),
        severity: 2,
        arrow: [{ x: cx, y: clampY(back.y + 18) }, { x: cx, y: clampY(back.y - 8) }],
        zoneId: zoneOf({ x: cx, y: back.y }),
      });
    }
  }

  // 5. Numbers — where we already outnumber them, and where they outnumber us.
  //    Only cells both sides are in: an empty half of the pitch is not a 4v0.
  const ours = outfieldOf(tokens, "player");
  const channels: [string, number, number][] = [["left", LANE_EDGES[0], LANE_EDGES[2]], ["centre", LANE_EDGES[2], LANE_EDGES[3]], ["right", LANE_EDGES[3], LANE_EDGES[5]]];
  for (let ti = 0; ti < 3; ti++) {
    for (const [name, x1, x2] of channels) {
      const inCell = (p: Point) => p.x >= x1 && p.x < x2 && p.y >= THIRD_EDGES[ti] && p.y < THIRD_EDGES[ti + 1];
      const us = ours.filter(inCell).length, them = theirs.filter(inCell).length;
      if (us === 0 || them === 0) continue;
      const where = `the ${name} of the ${THIRD_NAMES[THIRD_IDS[ti]]}`;
      const centre = { x: (x1 + x2) / 2, y: THIRD_EDGES[ti] + THIRD_H / 2 };
      if (us - them >= 2) {
        found.push({
          kind: "overload", label: `${us}v${them} overload in ${where}`,
          detail: "We already have the extra players here — keep the ball in this area until the free player is found.",
          polygon: rect(x1, THIRD_EDGES[ti], x2, THIRD_EDGES[ti + 1]),
          severity: us - them >= 3 ? 3 : 2,
          zoneId: zoneOf(centre),
        });
      } else if (them - us >= 2) {
        found.push({
          kind: "outnumbered", label: `Outnumbered ${us}v${them} in ${where}`,
          detail: "They have more players here. Avoid forcing play into this area, or bring a player across to even it up.",
          polygon: rect(x1, THIRD_EDGES[ti], x2, THIRD_EDGES[ti + 1]),
          severity: them - us >= 3 ? 3 : 2,
          zoneId: zoneOf(centre),
        });
      }
    }
  }

  const exploits = found
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.severity - a.e.severity || a.i - b.i)
    .slice(0, MAX_EXPLOITS)
    .map(({ e }, n) => ({ ...e, id: `x-${n + 1}`, source: "engine" as const }));
  return { lines, exploits };
}

/** The findings as plain text for an AI prompt — one numbered line each. */
export function describeReading(reading: OpponentReading): string {
  if (reading.exploits.length === 0) return "No clear gaps detected in their shape.";
  const lineCount = reading.lines.length;
  const shape = reading.lines.map((l) => l.players.length).join("-");
  return [
    `Their outfield reads as ${lineCount} line${lineCount === 1 ? "" : "s"} (${shape}, back line first).`,
    ...reading.exploits.map((e, i) => `${i + 1}. [${e.zoneId}] ${e.label} — ${e.detail}`),
  ].join("\n");
}
