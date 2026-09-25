// The AI opponent counter, as data the board can draw.
//
// analyseOpponent (actions/tactics.ts) asks the model for JSON anchored to
// board-analysis.ts's zone grid. This module is the pure half of that: the
// shape of the answer, the validator that decides what of the model's reply
// is trusted, and the conversion from its suggested runs into ordinary board
// shapes. Kept out of the "use server" file so Jest can test it without
// importing @google/genai (whose ESM build Jest can't load).

import { FORMATIONS } from "@/lib/formations";
import { uid, type Point, type Shape, type Token } from "@/lib/board-model";
import {
  isZoneId, zoneCentre, zoneRect, rectPolygon, zoneLabel, type Exploit, type ZoneId,
} from "@/lib/board-analysis";

export interface CounterExploit {
  zoneId: ZoneId;
  why: string;
  howTo: string;
}

export interface CounterRun {
  fromZoneId: ZoneId;
  toZoneId: ZoneId;
  kind: "run" | "pass" | "dribble";
  note: string;
}

export interface OpponentCounter {
  /** 2-3 sentences reading their shape. */
  reading: string;
  exploits: CounterExploit[];
  /** A FORMATIONS id, or null when the model suggested nothing usable. */
  counterFormationId: string | null;
  counterFormationWhy: string;
  counterRuns: CounterRun[];
  watchOut: string[];
  trainThisWeek: string;
}

const RUN_KINDS = new Set(["run", "pass", "dribble"]);
const MAX_ITEMS = 4;

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.replace(/\*/g, "").trim().slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/**
 * Keep only what the board can trust: zone ids that exist, a formation the
 * app actually has (and of the same size as ours, so "Apply" can't swap an
 * 11-a-side team into a 7-a-side shape), run kinds the board knows. Model
 * output is never drawn unchecked. Returns null when nothing usable is left,
 * so the caller can say so rather than draw an empty overlay.
 */
export function validateCounter(raw: Record<string, unknown> | null, squadSize?: number): OpponentCounter | null {
  if (!raw) return null;

  const exploits: CounterExploit[] = arr(raw.exploits)
    .map(obj)
    .filter((e) => typeof e.zoneId === "string" && isZoneId(e.zoneId))
    .map((e) => ({ zoneId: e.zoneId as ZoneId, why: str(e.why), howTo: str(e.howTo) }))
    .slice(0, MAX_ITEMS);

  const counterRuns: CounterRun[] = arr(raw.counterRuns)
    .map(obj)
    .filter((r) =>
      typeof r.fromZoneId === "string" && isZoneId(r.fromZoneId) &&
      typeof r.toZoneId === "string" && isZoneId(r.toZoneId) &&
      r.fromZoneId !== r.toZoneId &&
      typeof r.kind === "string" && RUN_KINDS.has(r.kind))
    .map((r) => ({
      fromZoneId: r.fromZoneId as ZoneId, toZoneId: r.toZoneId as ZoneId,
      kind: r.kind as CounterRun["kind"], note: str(r.note, 160),
    }))
    .slice(0, MAX_ITEMS);

  const fid = str(raw.counterFormationId, 40);
  const formation = FORMATIONS.find((f) => f.id === fid);
  const counterFormationId = formation && (!squadSize || formation.size === squadSize) ? formation.id : null;

  const counter: OpponentCounter = {
    reading: str(raw.reading, 600),
    exploits,
    counterFormationId,
    counterFormationWhy: counterFormationId ? str(raw.counterFormationWhy) : "",
    counterRuns,
    watchOut: arr(raw.watchOut).map((w) => str(w, 240)).filter(Boolean).slice(0, 3),
    trainThisWeek: str(raw.trainThisWeek),
  };
  if (!counter.reading && exploits.length === 0 && counterRuns.length === 0) return null;
  return counter;
}

/** The AI's exploit zones in the same form as the engine's, for one overlay. */
export function counterExploits(counter: OpponentCounter): Exploit[] {
  return counter.exploits.map((e, i) => ({
    id: `ai-${i + 1}`,
    kind: "ai-target" as const,
    label: zoneLabel(e.zoneId).replace(/^./, (c) => c.toUpperCase()),
    detail: [e.why, e.howTo].filter(Boolean).join(" "),
    polygon: rectPolygon(zoneRect(e.zoneId)),
    severity: 3 as const,
    zoneId: e.zoneId,
    source: "ai" as const,
  }));
}

/**
 * The suggested runs as editable board arrows. A run or dribble starts on
 * whichever of our players is nearest the zone it starts from, so pressing
 * Play (framesFromShapes grabs the token under an arrow's start) actually
 * moves that player; a pass starts from the zone itself. Two runs never
 * claim the same player.
 */
export function counterRunShapes(runs: CounterRun[], tokens: Pick<Token, "id" | "kind" | "group" | "x" | "y">[]): Shape[] {
  const used = new Set<string>();
  const ours = tokens.filter((t) => t.kind === "player" && t.group !== "Goalkeeper");
  return runs.map((r) => {
    const from = zoneCentre(r.fromZoneId);
    const to = zoneCentre(r.toZoneId);
    let start: Point = from;
    if (r.kind !== "pass") {
      const nearest = ours
        .filter((t) => !used.has(t.id))
        .reduce<(typeof ours)[number] | null>(
          (best, t) => (!best || Math.hypot(t.x - from.x, t.y - from.y) < Math.hypot(best.x - from.x, best.y - from.y) ? t : best),
          null
        );
      if (nearest) {
        used.add(nearest.id);
        start = { x: nearest.x, y: nearest.y };
      }
    }
    return { id: uid("s"), kind: r.kind, pts: [start, to] };
  });
}

// ── Opponent's usual shape ───────────────────────────────────────

export interface FormationTally {
  formationId: string;
  label: string;
  count: number;
}

/**
 * Which shapes a coach has set this opponent up in before, most used first,
 * from plays linked to fixtures against them. A play only counts if an
 * opponent was actually on the board: every saved play stores an
 * awayFormationId (the picker always has a value), so without that check a
 * play that never showed the opponent would still vote for the default.
 */
export function tallyOpponentFormations(
  plays: { awayFormationId?: unknown; tokens?: unknown }[]
): FormationTally[] {
  const counts = new Map<string, number>();
  for (const p of plays) {
    const hasOpponent = Array.isArray(p.tokens) && p.tokens.some((t) => obj(t).kind === "opponent");
    if (!hasOpponent || typeof p.awayFormationId !== "string") continue;
    if (!FORMATIONS.some((f) => f.id === p.awayFormationId)) continue;
    counts.set(p.awayFormationId, (counts.get(p.awayFormationId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([formationId, count]) => ({
      formationId, count, label: FORMATIONS.find((f) => f.id === formationId)!.label,
    }));
}

/** The counter as plain text — for read-aloud, and the same section
 * headings the old free-text answer used. */
export function renderCounterProse(c: OpponentCounter): string {
  const out: string[] = [];
  if (c.reading) out.push(`WHAT THEY ARE DOING: ${c.reading}`);
  if (c.exploits.length) {
    out.push("WHERE THE SPACE IS:");
    c.exploits.forEach((e, i) => out.push(`${i + 1}. ${zoneLabel(e.zoneId)} — ${e.why} ${e.howTo}`.trim()));
  }
  if (c.counterRuns.length) {
    out.push("HOW TO COUNTER:");
    c.counterRuns.forEach((r, i) => out.push(`${i + 1}. ${r.note || `${r.kind} from ${zoneLabel(r.fromZoneId)} into ${zoneLabel(r.toZoneId)}`}`));
  }
  const f = FORMATIONS.find((x) => x.id === c.counterFormationId);
  if (f) out.push(`SUGGESTED SHAPE: ${f.label}${c.counterFormationWhy ? ` — ${c.counterFormationWhy}` : ""}`);
  if (c.watchOut.length) {
    out.push("WATCH OUT FOR:");
    c.watchOut.forEach((w, i) => out.push(`${i + 1}. ${w}`));
  }
  if (c.trainThisWeek) out.push(`TRAIN THIS WEEK: ${c.trainThisWeek}`);
  return out.join("\n");
}
