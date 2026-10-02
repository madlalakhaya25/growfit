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

/** A point on the pitch: coordinates pulled back inside the markings. */
function onPitch(x: number, y: number, pitch: { w: number; h: number }): Point {
  return { x: round1(clamp(x, EDGE_INSET, pitch.w - EDGE_INSET)), y: round1(clamp(y, EDGE_INSET, pitch.h - EDGE_INSET)) };
}

interface ReadTokens {
  kept: RawToken[];
  /** The model's index of each readable token -> its index once the unreadable ones are gone. */
  oldToNew: Map<number, number>;
}

/** The tokens we can read, capped; a ball past the cap is skipped. */
function readTokens(raw: unknown): ReadTokens {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_DIAGRAM_TOKENS) : [];
  const kept: RawToken[] = [];
  const oldToNew = new Map<number, number>();
  let balls = 0;
  list.forEach((item, i) => {
    const t = readToken(item);
    if (!t) return;
    if (t.role === "ball" && ++balls > MAX_DIAGRAM_BALLS) return;
    oldToNew.set(i, kept.length);
    kept.push(t);
  });
  return { kept, oldToNew };
}

/** Clamp every token onto the pitch and keep the people apart. Null when that
 * cannot be done without moving someone far from where the model put them. */
function placeTokens(kept: RawToken[], pitch: { w: number; h: number }): Point[] | null {
  const pts: Point[] = kept.map((t) => ({
    x: clamp(t.x, TOKEN_INSET, pitch.w - TOKEN_INSET),
    y: clamp(t.y, TOKEN_INSET, pitch.h - TOKEN_INSET),
  }));
  // Only people are kept apart: a ball sits beside the player who has it.
  const people = kept.flatMap((t, i) => (t.role === "ball" ? [] : [pts[i]]));
  const before = people.map((p) => ({ ...p }));
  relax(people, pitch.w, pitch.h);
  const movedFar = people.some((p, i) => Math.hypot(p.x - before[i].x, p.y - before[i].y) > MAX_NUDGE);
  return crowded(people) || movedFar ? null : pts;
}

function buildTokens(kept: RawToken[], pts: Point[]): Token[] {
  let teamNo = 0;
  return kept.map((t, i): Token => {
    const base = { id: `t${i + 1}`, x: round1(pts[i].x), y: round1(pts[i].y) };
    if (t.role === "ball") return { ...base, label: "", kind: "ball", group: "Ball" };
    if (t.role === "opponent") return { ...base, label: "", kind: "opponent", group: GROUP_FOR_ROLE.opponent };
    return { ...base, label: String(++teamNo), kind: "player", group: GROUP_FOR_ROLE[t.role] };
  });
}

/** One arrow: starts on a token, ends on another token or a point. */
function readMove(m: unknown, tokens: Token[], oldToNew: Map<number, number>, pitch: { w: number; h: number }): Omit<Shape, "id"> | null {
  if (!isRecord(m)) return null;
  const kind = [...ARROW_SHAPE_KINDS].find((k) => k === m.kind);
  const from = isNum(m.from) ? oldToNew.get(m.from) : undefined;
  if (!kind || from === undefined) return null;
  const toTok = isNum(m.toToken) ? oldToNew.get(m.toToken) : undefined;
  let end: Point | null = null;
  if (toTok !== undefined && toTok !== from) end = { x: tokens[toTok].x, y: tokens[toTok].y };
  else if (isNum(m.x) && isNum(m.y)) end = onPitch(m.x, m.y, pitch);
  if (!end) return null;
  const start = { x: tokens[from].x, y: tokens[from].y };
  if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_MOVE_LENGTH) return null;
  const curve = isNum(m.curve) && m.curve !== 0 ? { curve: clamp(m.curve, -MAX_CURVE, MAX_CURVE) } : {};
  return { kind, pts: [start, end], ...curve };
}

/** A marked-out area: solid for space, hatched for "press here / no-go". */
function readZone(z: unknown, pitch: { w: number; h: number }): Omit<Shape, "id"> | null {
  if (!isRecord(z) || !Array.isArray(z.points)) return null;
  const poly = z.points
    .slice(0, MAX_ZONE_POINTS)
    .flatMap((p) => (isRecord(p) && isNum(p.x) && isNum(p.y) ? [onPitch(p.x, p.y, pitch)] : []));
  if (poly.length < 3) return null;
  return { kind: "zone", pts: poly, fill: z.hatch === true ? "hatch" : "solid" };
}

function readObject(e: unknown, pitch: { w: number; h: number }): Omit<BoardObject, "id"> | null {
  if (!isRecord(e) || !isNum(e.x) || !isNum(e.y)) return null;
  const kind = (Object.keys(EQUIPMENT_SPECS) as EquipmentKind[]).find((k) => k === e.kind);
  if (!kind) return null;
  return { kind, ...onPitch(e.x, e.y, pitch), ...(isNum(e.rotation) ? { rotation: round1(e.rotation % 360) } : {}) };
}

/** Read up to `max` entries of a model-written list with `read`, dropping the ones it rejects. */
function readList<T>(raw: unknown, max: number, read: (item: unknown) => T | null): T[] {
  return (Array.isArray(raw) ? raw.slice(0, max) : []).flatMap((item) => {
    const v = read(item);
    return v ? [v] : [];
  });
}

export function validateDiagram(raw: unknown): DrillDiagram | null {
  if (!isRecord(raw)) return null;
  const pitchId = DIAGRAM_PITCH_IDS.find((p) => p === raw.pitch);
  if (!pitchId) return null;
  const pitch = getPitch(pitchId);

  const { kept, oldToNew } = readTokens(raw.tokens);
  if (kept.filter((t) => t.role !== "ball").length < 2) return null;
  const pts = placeTokens(kept, pitch);
  if (!pts) return null;
  const tokens = buildTokens(kept, pts);

  // Zones sit under the arrows.
  const zones = readList(raw.zones, MAX_DIAGRAM_ZONES, (z) => readZone(z, pitch));
  const moves = readList(raw.moves, MAX_DIAGRAM_MOVES, (m) => readMove(m, tokens, oldToNew, pitch));
  const shapes: Shape[] = [...zones, ...moves].map((sh, i) => ({ ...sh, id: `${sh.kind === "zone" ? "z" : "m"}${i + 1}` }));
  const objects: BoardObject[] = readList(raw.equipment, MAX_DIAGRAM_OBJECTS, (e) => readObject(e, pitch)).map((o, i) => ({ ...o, id: `e${i + 1}` }));

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
