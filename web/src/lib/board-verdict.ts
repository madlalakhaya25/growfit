// "Will it work?": a plain-language read of every pass and run on the board,
// from the positions and arrows alone. Pure, and no AI: it only restates
// geometry the coach can see (a defender in the lane, a receiver beyond the
// offside line, a defender who gets to the spot first), so the same board
// always gets the same answer and nothing is invented.

import { reachTimes } from "@/lib/board-coaching";
import { distToSegment, offsideLines } from "@/lib/board-overlays";
import type { Pitch, Point, Shape, Token } from "@/lib/board-model";

type T = Pick<Token, "id" | "kind" | "group" | "x" | "y" | "label">;

export type VerdictLevel = "good" | "risky" | "poor";

export interface Verdict {
  shapeId: string;
  level: VerdictLevel;
  /** One short sentence for a coach to read at the pitch. */
  text: string;
}

export interface BoardVerdict {
  items: Verdict[];
  /** Counts by level, for a one-line summary. */
  good: number;
  risky: number;
  poor: number;
}

/** An opponent this close to the line of a pass cuts it out, and this close makes it a risk. */
const BLOCK_DIST = 3.5;
const RISK_DIST = 6;
/** Passer or receiver is the token this close to the arrow's end. */
const END_RADIUS = 6;

/** Longest pass worth asking of a player at this age, in metres. */
export function longPassMetres(ageGroup: string): number {
  const age = Number.parseInt(/\d+/.exec(ageGroup)?.[0] ?? "", 10);
  if (!Number.isFinite(age) || age >= 17) return 40;
  if (age <= 11) return 15;
  if (age <= 13) return 22;
  return 30;
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function nearestOf(pool: T[], p: Point, maxDist: number, exceptId?: string): T | null {
  let best: T | null = null;
  let bestD = maxDist;
  for (const t of pool) {
    if (t.id === exceptId) continue;
    const d = dist(t, p);
    if (d <= bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

const worst = (a: VerdictLevel, b: VerdictLevel): VerdictLevel =>
  a === "poor" || b === "poor" ? "poor" : a === "risky" || b === "risky" ? "risky" : "good";

function readPass(sh: Shape, tokens: T[], pitch: Pick<Pitch, "metresPerUnit">, ageGroup: string, offsideIds: Set<string>): Verdict | null {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const people = tokens.filter((t) => t.kind !== "ball");
  const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
  const passer = (sh.fromTokenId && byId.get(sh.fromTokenId)) || nearestOf(people, a, END_RADIUS);
  if (!passer) return null;
  const mates = people.filter((t) => t.kind === passer.kind);
  const receiver = (sh.toTokenId && byId.get(sh.toTokenId)) || nearestOf(mates, b, END_RADIUS, passer.id);
  if (!receiver || receiver.id === passer.id) {
    return { shapeId: sh.id, level: "risky", text: `${passer.label}'s pass goes into space: make sure a player arrives there on time.` };
  }

  const others = tokens.filter((t) => t.kind !== "ball" && t.kind !== passer.kind);
  const closest = others.reduce((m, o) => {
    const d = distToSegment(o, passer, receiver);
    return d === null ? m : Math.min(m, d);
  }, Infinity);

  const notes: string[] = [];
  let level: VerdictLevel = "good";
  if (closest < BLOCK_DIST) {
    level = worst(level, "poor");
    notes.push("a defender is in the way");
  } else if (closest < RISK_DIST) {
    level = worst(level, "risky");
    notes.push("a defender is close to the lane");
  }
  if (passer.kind === "player" && offsideIds.has(receiver.id)) {
    level = worst(level, "poor");
    notes.push(`${receiver.label} is offside`);
  }
  const metres = dist(passer, receiver) * pitch.metresPerUnit;
  if (metres > longPassMetres(ageGroup)) {
    level = worst(level, "risky");
    notes.push(`${Math.round(metres)} m is a long pass for this age`);
  }

  const head = `${passer.label} to ${receiver.label}`;
  return { shapeId: sh.id, level, text: notes.length ? `${head}: ${notes.join(", ")}.` : `${head}: clear lane, onside.` };
}

/** Every pass and run on the board, read for whether it is likely to come off. */
export function willItWork(
  tokens: T[],
  shapes: Shape[],
  pitch: Pick<Pitch, "metresPerUnit">,
  ageGroup: string
): BoardVerdict {
  const offsideIds = new Set(offsideLines(tokens, pitch).offsideIds);
  const times = new Map(reachTimes(tokens, shapes, pitch, ageGroup).map((r) => [r.shapeId, r]));
  const people = tokens.filter((t) => t.kind !== "ball");
  const items: Verdict[] = [];

  for (const sh of shapes) {
    if (sh.kind === "pass") {
      const v = readPass(sh, tokens, pitch, ageGroup, offsideIds);
      if (v) items.push(v);
    } else if (sh.kind === "run" || sh.kind === "dribble" || sh.kind === "press") {
      const r = times.get(sh.id);
      const mover = nearestOf(people, sh.pts[0], 10);
      if (!r || !mover) continue;
      const verb = sh.kind === "press" ? "press" : "run";
      if (!r.rival) items.push({ shapeId: sh.id, level: "good", text: `${mover.label}'s ${verb}: nobody to beat to the spot.` });
      else if (r.verdict === "first") items.push({ shapeId: sh.id, level: "good", text: `${mover.label}'s ${verb} gets there first (${r.seconds.toFixed(1)}s).` });
      else if (r.verdict === "contest") items.push({ shapeId: sh.id, level: "risky", text: `${mover.label}'s ${verb} is a close race with ${r.rival.label}.` });
      else items.push({ shapeId: sh.id, level: "poor", text: `${r.rival.label} gets to the spot before ${mover.label}'s ${verb}.` });
    }
  }
  return {
    items,
    good: items.filter((i) => i.level === "good").length,
    risky: items.filter((i) => i.level === "risky").length,
    poor: items.filter((i) => i.level === "poor").length,
  };
}
