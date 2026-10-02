// A board described in a sentence, as data the board can trust.
//
// "4-3-3, press high, left back overlapping" goes to the model, which answers
// with JSON. This module is the pure half: what of that reply is believed
// (validateBoardSketch, in the same discipline as validateCounter) and the
// conversion of the believed part into ordinary board tokens and shapes
// (buildBoard). Kept out of the "use server" file so Jest can test it without
// importing @google/genai.

import { FORMATIONS, type Formation } from "@/lib/formations";
import {
  ARROW_SHAPE_KINDS, BOARD_H, BOARD_W, assignToSlots, groupOf, shortLabel, uid,
  type BoardPlayer, type Point, type Shape, type ShapeKind, type Token,
} from "@/lib/board-model";

/** A drawing the generator can place. The model never positions a token: it
 * names a formation, and every arrow is anchored to one of that formation's
 * slots by index, so a run can only start where a player really stands. */
export interface SketchShape {
  kind: ShapeKind;
  /** Arrows: the slot the movement starts from. */
  fromSlot?: number;
  /** Arrows: a slot to end on (a pass to a teammate)... */
  toSlot?: number;
  /** ...or a point to end on. */
  to?: Point;
  /** Zones: the polygon. */
  pts?: Point[];
  /** Zones: hatch reads "press here / no-go", solid reads "space". */
  hatch?: boolean;
}

export interface BoardSketch {
  name: string;
  formationId: string;
  shapes: SketchShape[];
}

export type SketchResult =
  | { ok: true; sketch: BoardSketch; dropped: number }
  | { ok: false; error: string };

export const MAX_SKETCH_SHAPES = 12;
export const MAX_ZONE_POINTS = 8;
export const MAX_SENTENCE_CHARS = 300;

/** What a sentence can ask for: arrows and zones. The rest of ShapeKind
 * (freehand, spotlight, text) have no meaning without a hand to draw them. */
const SKETCH_KINDS: ReadonlySet<ShapeKind> = new Set<ShapeKind>([...ARROW_SHAPE_KINDS, "zone"]);

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readPoint(v: unknown): Point | null {
  if (!v || typeof v !== "object") return null;
  const { x, y } = v as Record<string, unknown>;
  if (!isNum(x) || !isNum(y)) return null;
  return { x: clamp(x, BOARD_W), y: clamp(y, BOARD_H) };
}

const isSlot = (v: unknown, f: Formation): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < f.slots.length;

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\*/g, "").trim().slice(0, max) : "";

/**
 * Believe only what the board can draw: a formation the app has AND whose size
 * is the team's (so a 7-a-side shape never lands on an 11-a-side board -- the
 * same reason validateCounter takes a squad size), arrows that start on a real
 * slot, kinds in the allowed set, every coordinate inside the pitch, and a cap
 * on how many shapes. Anything else is dropped and counted, never drawn.
 */
export function validateBoardSketch(raw: Record<string, unknown> | null, squadSize: number): SketchResult {
  if (!raw) return { ok: false, error: "Could not read the AI's board. Try rewording it." };

  const formation = FORMATIONS.find((f) => f.id === raw.formationId);
  if (!formation) return { ok: false, error: "Couldn't tell which formation you meant. Try naming one, like 4-3-3." };
  if (formation.size !== squadSize) {
    return {
      ok: false,
      error: `${formation.label} is a ${formation.size}-a-side shape, but this board is set to ${squadSize}-a-side. Change the formation on the board first, or pick one that matches.`,
    };
  }

  const shapes: SketchShape[] = [];
  let dropped = 0;
  const offered = Array.isArray(raw.shapes) ? raw.shapes : [];
  for (const item of offered) {
    if (shapes.length >= MAX_SKETCH_SHAPES) { dropped++; continue; }
    const s = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const kind = s && typeof s.kind === "string" ? (s.kind as ShapeKind) : null;
    if (!s || !kind || !SKETCH_KINDS.has(kind)) { dropped++; continue; }

    if (kind === "zone") {
      const pts = (Array.isArray(s.pts) ? s.pts : []).map(readPoint);
      if (pts.length < 3 || pts.length > MAX_ZONE_POINTS || pts.some((p) => !p)) { dropped++; continue; }
      shapes.push({ kind, pts: pts as Point[], hatch: s.hatch === true });
      continue;
    }

    if (!isSlot(s.fromSlot, formation)) { dropped++; continue; }
    const start = formation.slots[s.fromSlot];
    let end: Point | null = null;
    let toSlot: number | undefined;
    if (isSlot(s.toSlot, formation)) {
      toSlot = s.toSlot;
      end = formation.slots[toSlot];
    } else {
      end = readPoint(s.to);
    }
    // An arrow that goes nowhere has nothing to animate or draw.
    if (!end || Math.hypot(end.x - start.x, end.y - start.y) < 2) { dropped++; continue; }
    shapes.push({ kind, fromSlot: s.fromSlot, toSlot, to: toSlot === undefined ? end : undefined });
  }

  return { ok: true, dropped, sketch: { name: text(raw.name, 80), formationId: formation.id, shapes } };
}

/**
 * Real tokens and shapes from a believed sketch. Players come from the roster
 * through assignToSlots' own exact -> group -> leftover cascade; a slot the
 * roster can't fill gets a position-labelled token instead of a gap.
 */
export function buildBoard(sketch: BoardSketch, roster: BoardPlayer[]): { tokens: Token[]; shapes: Shape[] } {
  const formation = FORMATIONS.find((f) => f.id === sketch.formationId)!;
  const assigned = assignToSlots(formation, roster);

  const tokens: Token[] = formation.slots.map((slot, i) => {
    const p = assigned[i];
    return {
      id: uid("t"),
      kind: "player",
      x: slot.x,
      y: slot.y,
      label: p ? shortLabel(p.full_name) : slot.role.toUpperCase(),
      group: groupOf(p ? p.position : slot.role),
      ...(p ? { playerId: p.id } : {}),
    };
  });

  const shapes: Shape[] = sketch.shapes.map((s) => {
    if (s.kind === "zone") {
      return { id: uid("s"), kind: "zone", pts: s.pts!, fill: s.hatch ? "hatch" : "solid" };
    }
    const start = formation.slots[s.fromSlot!];
    const end = s.toSlot !== undefined ? formation.slots[s.toSlot] : s.to!;
    return { id: uid("s"), kind: s.kind, pts: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }] };
  });

  return { tokens, shapes };
}

/** The formation list the model chooses from: id, label, size and each slot's
 * index, role and position, so an arrow can be anchored by slot index. */
export function formationMenu(): string {
  return FORMATIONS.map((f) =>
    `${f.id} "${f.label}" ${f.size}-a-side: ` +
    f.slots.map((s, i) => `${i}=${s.role}(${s.x},${s.y})`).join(" ")
  ).join("\n");
}
