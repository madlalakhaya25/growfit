// A drill drawn on a pitch, as data the board renderer can trust.
//
// The model describes a drill's layout as JSON; this module is the pure half:
// what of that reply is believed, and its conversion into the ordinary board
// types (Token, Shape, BoardObject) that PitchLayer, ShapeGlyph and
// EquipmentLayer already draw. Kept out of the "use server" file so Jest can
// test it without importing @google/genai.
//
// A diagram is an extra on a drill, never a requirement: anything that does
// not hold together (a player off the pitch is pulled back on, but a layout
// that stays crowded or has no players is dropped) comes back as null and the
// drill is shown without one.

import {
  ARROW_SHAPE_KINDS, EQUIPMENT_SPECS, getPitch,
  type BoardObject, type EquipmentKind, type Point, type Shape, type Token,
} from "@/lib/board-model";

/** The pitches a drill can sit on. "third" is left out: no drill is set there. */
export const DIAGRAM_PITCH_IDS = ["grid-small", "grid-large", "half", "full"] as const;
export type DiagramPitchId = (typeof DIAGRAM_PITCH_IDS)[number];

export const DIAGRAM_ROLES = ["team", "opponent", "keeper", "ball"] as const;
type DiagramRole = (typeof DIAGRAM_ROLES)[number];

export interface DrillDiagram {
  pitchId: DiagramPitchId;
  tokens: Token[];
  shapes: Shape[];
  objects: BoardObject[];
}

export const MAX_DIAGRAM_TOKENS = 24;
export const MAX_DIAGRAM_BALLS = 6;
export const MAX_DIAGRAM_OBJECTS = 40;
export const MAX_DIAGRAM_MOVES = 16;
export const MAX_DIAGRAM_ZONES = 3;
export const MAX_ZONE_POINTS = 8;

/** Token disc radius on the board (token-glyph.tsx), plus a hair of margin. */
const TOKEN_R = 4.2;
const TOKEN_INSET = TOKEN_R + 1;
const EDGE_INSET = 2;
/** Two discs this close or closer are pushed apart. A layout that is still
 * overlapping afterwards, or that needed a player moved further than
 * `MAX_NUDGE` to make room, is not what the model drew any more (its arrows
 * and zones would no longer line up), so it is dropped. */
const MIN_GAP = TOKEN_R * 2 - 0.4;
const HARD_OVERLAP = TOKEN_R * 1.5;
const MAX_NUDGE = 14;
const MIN_MOVE_LENGTH = 4;
const MAX_CURVE = 0.4;
const RELAX_PASSES = 40;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

const GROUP_FOR_ROLE: Record<Exclude<DiagramRole, "ball">, string> = {
  team: "Midfielder",
  keeper: "Goalkeeper",
  opponent: "Opponent",
};

interface RawToken { role: DiagramRole; x: number; y: number }

function readToken(v: unknown): RawToken | null {
  if (!isRecord(v)) return null;
  const role = DIAGRAM_ROLES.find((r) => r === v.role);
  if (!role || !isNum(v.x) || !isNum(v.y)) return null;
  return { role, x: v.x, y: v.y };
}

/** Push overlapping discs apart along the line between them, then back inside
 * the pitch. Deterministic: the same input always settles the same way. */
function relax(points: Point[], w: number, h: number): void {
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN_GAP) continue;
        // Exactly stacked: split sideways, in a direction fixed by the pair.
        const ux = d === 0 ? 1 : dx / d;
        const uy = d === 0 ? 0 : dy / d;
        const push = (MIN_GAP - d) / 2 + 0.05;
        points[i].x -= ux * push; points[i].y -= uy * push;
        points[j].x += ux * push; points[j].y += uy * push;
        moved = true;
      }
    }
    for (const p of points) {
      p.x = clamp(p.x, TOKEN_INSET, w - TOKEN_INSET);
      p.y = clamp(p.y, TOKEN_INSET, h - TOKEN_INSET);
    }
    if (!moved) return;
  }
}

function crowded(points: Point[]): boolean {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y) < HARD_OVERLAP) return true;
    }
  }
  return false;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function validateDiagram(raw: unknown): DrillDiagram | null {
  if (!isRecord(raw)) return null;
  const pitchId = DIAGRAM_PITCH_IDS.find((p) => p === raw.pitch);
  if (!pitchId) return null;
  const pitch = getPitch(pitchId);

  // Tokens. `oldToNew` lets a move name a token by its position in the model's
  // list even after unreadable entries have been dropped.
  const rawTokens = Array.isArray(raw.tokens) ? raw.tokens.slice(0, MAX_DIAGRAM_TOKENS) : [];
  const kept: RawToken[] = [];
  const oldToNew = new Map<number, number>();
  let balls = 0;
  rawTokens.forEach((item, i) => {
    const t = readToken(item);
    if (!t) return;
    if (t.role === "ball" && ++balls > MAX_DIAGRAM_BALLS) return;
    oldToNew.set(i, kept.length);
    kept.push(t);
  });
  const people = kept.filter((t) => t.role !== "ball");
  if (people.length < 2) return null;

  const pts: Point[] = kept.map((t) => ({
    x: clamp(t.x, TOKEN_INSET, pitch.w - TOKEN_INSET),
    y: clamp(t.y, TOKEN_INSET, pitch.h - TOKEN_INSET),
  }));
  // Only people are kept apart: a ball sits beside the player who has it.
  const personIdx = kept.flatMap((t, i) => (t.role === "ball" ? [] : [i]));
  const personPts = personIdx.map((i) => pts[i]);
  const before = personPts.map((p) => ({ ...p }));
  relax(personPts, pitch.w, pitch.h);
  if (crowded(personPts) || personPts.some((p, i) => Math.hypot(p.x - before[i].x, p.y - before[i].y) > MAX_NUDGE)) return null;

  let teamNo = 0;
  const tokens: Token[] = kept.map((t, i) => {
    const base = { id: `t${i + 1}`, x: round1(pts[i].x), y: round1(pts[i].y) };
    if (t.role === "ball") return { ...base, label: "", kind: "ball", group: "Ball" };
    if (t.role === "opponent") return { ...base, label: "", kind: "opponent", group: GROUP_FOR_ROLE.opponent };
    return { ...base, label: String(++teamNo), kind: "player", group: GROUP_FOR_ROLE[t.role] };
  });

  // Moves: an arrow starts on a token and ends on another token or a point.
  const shapes: Shape[] = [];
  const rawMoves = Array.isArray(raw.moves) ? raw.moves.slice(0, MAX_DIAGRAM_MOVES) : [];
  for (const m of rawMoves) {
    if (!isRecord(m)) continue;
    const kind = [...ARROW_SHAPE_KINDS].find((k) => k === m.kind);
    const from = isNum(m.from) ? oldToNew.get(m.from) : undefined;
    if (!kind || from === undefined) continue;
    const toTok = isNum(m.toToken) ? oldToNew.get(m.toToken) : undefined;
    let end: Point | null = null;
    if (toTok !== undefined && toTok !== from) end = { x: tokens[toTok].x, y: tokens[toTok].y };
    else if (isNum(m.x) && isNum(m.y)) {
      end = { x: round1(clamp(m.x, EDGE_INSET, pitch.w - EDGE_INSET)), y: round1(clamp(m.y, EDGE_INSET, pitch.h - EDGE_INSET)) };
    }
    if (!end) continue;
    const start = { x: tokens[from].x, y: tokens[from].y };
    if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_MOVE_LENGTH) continue;
    shapes.push({
      id: `m${shapes.length + 1}`, kind, pts: [start, end],
      ...(isNum(m.curve) && m.curve !== 0 ? { curve: clamp(m.curve, -MAX_CURVE, MAX_CURVE) } : {}),
    });
  }

  // Zones: a marked-out area, solid for space or hatched for "press here".
  const rawZones = Array.isArray(raw.zones) ? raw.zones.slice(0, MAX_DIAGRAM_ZONES) : [];
  for (const z of rawZones) {
    if (!isRecord(z) || !Array.isArray(z.points)) continue;
    const poly: Point[] = [];
    for (const p of z.points.slice(0, MAX_ZONE_POINTS)) {
      if (isRecord(p) && isNum(p.x) && isNum(p.y)) {
        poly.push({ x: round1(clamp(p.x, EDGE_INSET, pitch.w - EDGE_INSET)), y: round1(clamp(p.y, EDGE_INSET, pitch.h - EDGE_INSET)) });
      }
    }
    if (poly.length < 3) continue;
    shapes.unshift({ id: `z${shapes.length + 1}`, kind: "zone", pts: poly, fill: z.hatch === true ? "hatch" : "solid" });
  }

  // Equipment.
  const objects: BoardObject[] = [];
  const rawKit = Array.isArray(raw.equipment) ? raw.equipment.slice(0, MAX_DIAGRAM_OBJECTS) : [];
  for (const e of rawKit) {
    if (!isRecord(e) || !isNum(e.x) || !isNum(e.y)) continue;
    const kind = (Object.keys(EQUIPMENT_SPECS) as EquipmentKind[]).find((k) => k === e.kind);
    if (!kind) continue;
    objects.push({
      id: `e${objects.length + 1}`, kind,
      x: round1(clamp(e.x, EDGE_INSET, pitch.w - EDGE_INSET)),
      y: round1(clamp(e.y, EDGE_INSET, pitch.h - EDGE_INSET)),
      ...(isNum(e.rotation) ? { rotation: round1(e.rotation % 360) } : {}),
    });
  }

  return { pitchId, tokens, shapes, objects };
}

/** A sentence a screen reader can read in place of the picture. */
export function describeDiagram(d: DrillDiagram): string {
  const count = (kind: Token["kind"], group?: string) =>
    d.tokens.filter((t) => t.kind === kind && (group === undefined || t.group === group)).length;
  const keepers = count("player", "Goalkeeper");
  const team = count("player") - keepers;
  const parts = [`${team} ${team === 1 ? "player" : "players"}`];
  if (keepers) parts.push(`${keepers} ${keepers === 1 ? "goalkeeper" : "goalkeepers"}`);
  const opp = count("opponent");
  if (opp) parts.push(`${opp} ${opp === 1 ? "opponent" : "opponents"}`);
  if (d.objects.length) parts.push(`${d.objects.length} ${d.objects.length === 1 ? "piece" : "pieces"} of kit`);
  const moves = d.shapes.filter((s) => ARROW_SHAPE_KINDS.has(s.kind)).length;
  if (moves) parts.push(`${moves} ${moves === 1 ? "movement" : "movements"} marked`);
  return `Drill diagram: ${parts.join(", ")}.`;
}
