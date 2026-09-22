// Shared drawing primitives for the tactics board.
//
// Before this file, the same handful of small facts — what colour a run vs.
// a pass vs. a dribble line is, how to draw the wavy dribble path, what a
// 100×150 board looks like painted — were each copied independently into
// three places: the interactive SVG board (tactical-board.tsx), the
// read-only shared/player-facing viewer (play-viewer.tsx), and the Canvas 2D
// renderer used for recording (board-render.ts). A new shape kind used to
// mean writing it three times and hoping the three copies never drifted.
//
// This module is the one place those facts live now. The three renderers
// import from here instead of redefining them. It is deliberately pure data
// and pure functions — no React, no DOM — so it's usable from a `"use
// client"` SVG component, a canvas 2D context, and a plain test file alike.

import { POSITIONS } from "@/lib/types";
import type { Formation } from "@/lib/formations";

// ── Geometry ─────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/** The pitch-shaped board's coordinate space. Formation presets in
 * lib/formations.ts are absolute coordinates in this space, so it stays
 * fixed even when a different Pitch (see below) changes what's painted
 * behind the tokens. */
export const BOARD_W = 100;
export const BOARD_H = 150;

/** Convert a pointer event's client coordinates into board space, clamped
 * to stay on the pitch. Works for any element whose bounding rect maps
 * linearly onto a `w`×`h` viewBox — the pitch today, a training-grid pitch
 * or a still frame tomorrow. */
export function toBoardSpace(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  w: number = BOARD_W,
  h: number = BOARD_H
): Point {
  return {
    x: Math.max(2, Math.min(w - 2, ((clientX - rect.left) / rect.width) * w)),
    y: Math.max(2, Math.min(h - 2, ((clientY - rect.top) / rect.height) * h)),
  };
}

/** SVG path data for a wavy "dribble" line between two points — the same
 * zig-zag construction used by both SVG renderers. */
export function dribblePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return `M${x1},${y1}`;
  const px = -dy / len, py = dx / len;
  const n = Math.max(2, Math.round(len / 3.2));
  let d = `M${x1},${y1}`;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    const off = (i % 2 === 0 ? 1 : -1) * 1.5;
    d += ` L${(cx + px * off).toFixed(2)},${(cy + py * off).toFixed(2)}`;
  }
  return d + ` L${x2},${y2}`;
}

/** Flattened polyline path data, used for freehand shapes. */
export function polyPath(pts: Point[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// ── Shapes ───────────────────────────────────────────────────────
//
// "zone", "spotlight" and "text" are new — added once here so both the
// interactive board and the read-only viewers pick them up together, rather
// than the interactive board gaining a tool the shared view can't render.

export type ShapeKind = "run" | "pass" | "dribble" | "free" | "zone" | "spotlight" | "text";

/** A drawn shape. `pts` means different things per kind:
 *  - run/pass/dribble: exactly [start, end] — a 2-point arrow
 *  - free/zone: an arbitrary polyline/polygon
 *  - spotlight: [centre] — radius comes from `radius`
 *  - text: [anchor] — the label comes from `text`
 * `color`/`width` are optional per-shape overrides; a shape with neither
 * falls back to SHAPE_STROKE / the default width below, so every play saved
 * before this file existed still renders exactly as it did. */
export interface Shape {
  id: string;
  kind: ShapeKind;
  pts: Point[];
  color?: string;
  width?: number;
  /** spotlight only: ring radius in board units. */
  radius?: number;
  /** text only: the label shown at pts[0]. */
  text?: string;
  /** spotlight/text only: binds this shape to a token's player so it can be
   * looked up again after the token is removed or replaced — a spotlight
   * outlives a substitution, a note stays attached to the right player. */
  playerId?: string;
}

export const DEFAULT_SHAPE_WIDTH = 1.2;

/** Default stroke colour per shape kind. A shape's own `color` always wins
 * when set — see Shape.color above. */
export const SHAPE_STROKE: Record<ShapeKind, string> = {
  run: "#fde047",
  pass: "#fde047",
  dribble: "#38bdf8",
  free: "#f472b6",
  zone: "#facc15",
  spotlight: "#f8fafc",
  text: "#f8fafc",
};

export function shapeColor(sh: Pick<Shape, "kind" | "color">): string {
  return sh.color ?? SHAPE_STROKE[sh.kind];
}
export function shapeWidth(sh: Pick<Shape, "width">): number {
  return sh.width ?? DEFAULT_SHAPE_WIDTH;
}

/** Kinds board-render.ts's canvas drawBoard() actually knows how to draw
 * (its "free"/"dribble" branches, plus the generic arrow line for
 * run/pass) — it has no polygon-fill or text-label rendering. A caller
 * feeding it a full Shape[] should filter to this set first; passing a
 * zone/spotlight/text through unfiltered doesn't error, it silently draws
 * as a stray line/arrow between the shape's first and last point. */
export const RECORDABLE_SHAPE_KINDS: ReadonlySet<ShapeKind> = new Set(["run", "pass", "dribble", "free"]);

/**
 * Where a spotlight actually draws: it follows the player it's bound to,
 * not a fixed point. A token surviving a substitution gets a new board id
 * (see tactical-board.tsx's substitute()) but keeps its playerId, so
 * resolving by playerId — not by the shape's own stored point — is what
 * makes a spotlight "outlive" a substitution and track the player through
 * every frame of an animation rather than needing to be redrawn each step.
 * Falls back to the shape's stored point if the player isn't on the board
 * right now (subbed off, or viewing a step before they came on).
 */
export function resolveSpotlightCenter(
  sh: Pick<Shape, "playerId" | "pts">,
  tokens: Pick<Token, "playerId" | "x" | "y">[]
): Point | undefined {
  if (sh.playerId) {
    const tok = tokens.find((t) => t.playerId === sh.playerId);
    if (tok) return { x: tok.x, y: tok.y };
  }
  return sh.pts[0];
}

/** A coach's note about one player, optionally pinned to a specific step of
 * a play/drill. Lives alongside a board's tokens/shapes/objects — kept as
 * its own array (not folded into Shape) because a note has no geometry of
 * its own and outlives whichever spotlight shape prompted it. */
export interface PlayerNote {
  id: string;
  playerId: string;
  /** null = a general note about the player, not tied to one step. */
  frameId: string | null;
  body: string;
}

// ── Tokens & frames ──────────────────────────────────────────────

export interface Token {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "player" | "opponent" | "ball";
  group: string;
  playerId?: string;
}

export const GROUP_COLOR: Record<string, string> = {
  Goalkeeper: "#f59e0b",
  Defender: "#3b82f6",
  Midfielder: "#22c55e",
  Forward: "#ef4444",
  Opponent: "#0f172a",
  Ball: "#f8fafc",
};

/** One step of a play: where every token sits, the lines drawn at that
 * step, and — new — how long this step takes to arrive and how it eases.
 * Both are optional so a play saved before per-step timing existed still
 * animates identically: every step held the same 1100ms with the same ease,
 * and that stays the default when a step doesn't say otherwise. */
export interface Frame {
  id: string;
  tokens: { id: string; x: number; y: number }[];
  shapes: Shape[];
  /** ms this step takes to arrive from the previous one. Meaningless on
   * frame 0 (the start position, not a transition). */
  durationMs?: number;
  ease?: "linear" | "ease-in-out";
}

export const DEFAULT_FRAME_DURATION_MS = 1100;

const EASINGS: Record<NonNullable<Frame["ease"]>, (t: number) => number> = {
  linear: (t) => t,
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

/**
 * Where every token and which shapes are showing at `elapsedMs` into a
 * frame sequence. This is the one place the segment/ease/lerp maths lives —
 * before this, board playback (tactical-board.tsx), the recorder, and
 * play-viewer.tsx each reimplemented the same stepping logic independently,
 * with no guarantee a fix to one reached the other two.
 */
export function interpolateFrames<T extends { id: string }>(
  baseTokens: T[],
  frames: Frame[],
  elapsedMs: number
): { tokens: (T & Point)[]; shapes: Shape[] } {
  if (frames.length < 2) {
    return { tokens: baseTokens as (T & Point)[], shapes: frames[0]?.shapes ?? [] };
  }

  let acc = 0;
  let seg = 0;
  for (; seg < frames.length - 2; seg++) {
    const dur = frames[seg + 1].durationMs ?? DEFAULT_FRAME_DURATION_MS;
    if (elapsedMs < acc + dur) break;
    acc += dur;
  }
  const segDuration = frames[seg + 1].durationMs ?? DEFAULT_FRAME_DURATION_MS;
  const ease = EASINGS[frames[seg + 1].ease ?? "ease-in-out"];
  const local = ease(Math.max(0, Math.min((elapsedMs - acc) / segDuration, 1)));

  const from = frames[seg];
  const to = frames[seg + 1];

  return {
    tokens: baseTokens.map((t) => {
      const a = from.tokens.find((ft) => ft.id === t.id);
      const b = to.tokens.find((ft) => ft.id === t.id);
      if (!a || !b) return t as T & Point;
      return { ...t, x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }),
    // Defensive: a stored frame missing `shapes` (shouldn't happen from
    // this app's own writers, but this reads data saved months apart by
    // different code) shows nothing instead of throwing downstream where
    // a caller maps over this array.
    shapes: to.shapes ?? [],
  };
}

/** Total duration of a frame sequence, in ms — every transition's duration
 * summed (frame 0 contributes nothing, it's the start position). */
export function totalDurationMs(frames: Frame[]): number {
  return frames.slice(1).reduce((sum, f) => sum + (f.durationMs ?? DEFAULT_FRAME_DURATION_MS), 0);
}

// ── Pitches ──────────────────────────────────────────────────────
//
// The 16 formation presets in lib/formations.ts are absolute coordinates in
// the fixed 100×150 BOARD_W×BOARD_H space, so switching pitches can't just
// resize the viewBox — a preset drawn at y=142 means "the edge of a full
// pitch" regardless of what's currently painted behind it. Full/half/third
// stay in that same 100×150 space (they're regions of it, so every preset
// keeps working untouched); training grids get their own smaller space
// where formations simply don't apply, because a drill doesn't use them.

export interface PitchMarking {
  kind: "rect" | "circle" | "line" | "dot" | "grid";
  // rect
  x?: number; y?: number; w?: number; h?: number;
  // circle / dot
  cx?: number; cy?: number; r?: number;
  // line
  x1?: number; y1?: number; x2?: number; y2?: number;
  // grid: square cells at this spacing across the whole pitch
  spacing?: number;
}

export interface Pitch {
  id: string;
  label: string;
  w: number;
  h: number;
  /** Whether the 16 formation presets (in the fixed 100×150 space) are
   * meaningful on this pitch. Only true for the full pitch — a preset
   * places a full XI across the whole 100×150 space (a goalkeeper as deep
   * as y=142), which doesn't fit inside a cropped half/third viewBox any
   * more than it fits a training grid's own, unrelated coordinate space.
   * "Set up my XI" and video recording (board-render.ts's drawBoard isn't
   * pitch-aware) are both disabled wherever this is false; manual
   * placement (placePlayer/addBall/addOpponent) still works everywhere,
   * centred on whichever pitch is current. */
  supportsFormations: boolean;
  markings: PitchMarking[];
}

const FULL_MARKINGS: PitchMarking[] = [
  { kind: "rect", x: 2, y: 2, w: BOARD_W - 4, h: BOARD_H - 4 },
  { kind: "line", x1: 2, y1: BOARD_H / 2, x2: BOARD_W - 2, y2: BOARD_H / 2 },
  { kind: "circle", cx: BOARD_W / 2, cy: BOARD_H / 2, r: 11 },
  { kind: "dot", cx: BOARD_W / 2, cy: BOARD_H / 2, r: 0.8 },
  { kind: "rect", x: 26, y: 2, w: 48, h: 20 },
  { kind: "rect", x: 38, y: 2, w: 24, h: 8 },
  { kind: "rect", x: 26, y: BOARD_H - 22, w: 48, h: 20 },
  { kind: "rect", x: 38, y: BOARD_H - 10, w: 24, h: 8 },
  { kind: "dot", cx: BOARD_W / 2, cy: 16, r: 0.8 },
  { kind: "dot", cx: BOARD_W / 2, cy: BOARD_H - 16, r: 0.8 },
];

export const PITCHES: Pitch[] = [
  { id: "full", label: "Full pitch", w: BOARD_W, h: BOARD_H, supportsFormations: true, markings: FULL_MARKINGS },
  {
    id: "half",
    label: "Half pitch (attacking)",
    w: BOARD_W, h: BOARD_H / 2, supportsFormations: false,
    markings: [
      { kind: "rect", x: 2, y: 2, w: BOARD_W - 4, h: BOARD_H / 2 - 4 },
      { kind: "rect", x: 26, y: 2, w: 48, h: 20 },
      { kind: "rect", x: 38, y: 2, w: 24, h: 8 },
      { kind: "dot", cx: BOARD_W / 2, cy: 16, r: 0.8 },
      { kind: "circle", cx: BOARD_W / 2, cy: BOARD_H / 2 - 2, r: 11 },
    ],
  },
  {
    id: "third",
    label: "Attacking third",
    w: BOARD_W, h: BOARD_H / 3, supportsFormations: false,
    markings: [
      { kind: "rect", x: 2, y: 2, w: BOARD_W - 4, h: BOARD_H / 3 - 4 },
      { kind: "rect", x: 26, y: 2, w: 48, h: 20 },
      { kind: "rect", x: 38, y: 2, w: 24, h: 8 },
      { kind: "dot", cx: BOARD_W / 2, cy: 16, r: 0.8 },
    ],
  },
  {
    id: "grid-small",
    label: "Training grid (small, 20×20m)",
    w: 60, h: 60, supportsFormations: false,
    markings: [{ kind: "rect", x: 2, y: 2, w: 56, h: 56 }, { kind: "grid", spacing: 10 }],
  },
  {
    id: "grid-large",
    label: "Training grid (large, 30×40m)",
    w: 60, h: 80, supportsFormations: false,
    markings: [{ kind: "rect", x: 2, y: 2, w: 56, h: 76 }, { kind: "grid", spacing: 10 }],
  },
];

export function getPitch(id: string | undefined): Pitch {
  return PITCHES.find((p) => p.id === id) ?? PITCHES[0];
}

// ── Equipment (training objects) ────────────────────────────────

export type EquipmentKind =
  | "cone" | "flat-marker" | "mannequin" | "mini-goal" | "goal"
  | "pole" | "ladder" | "hurdle" | "ball-cluster" | "bib";

export interface EquipmentSpec {
  kind: EquipmentKind;
  label: string;
  color: string;
  /** Rough footprint in board units, for a default placement/spacing. */
  w: number;
  h: number;
}

export const EQUIPMENT_SPECS: Record<EquipmentKind, EquipmentSpec> = {
  cone:         { kind: "cone",         label: "Cone",          color: "#f97316", w: 2, h: 2 },
  "flat-marker":{ kind: "flat-marker",  label: "Flat marker",   color: "#eab308", w: 1.6, h: 1.6 },
  mannequin:    { kind: "mannequin",    label: "Mannequin",     color: "#64748b", w: 2.5, h: 5 },
  "mini-goal":  { kind: "mini-goal",    label: "Mini goal",     color: "#e2e8f0", w: 8, h: 3 },
  goal:         { kind: "goal",         label: "Full goal",     color: "#e2e8f0", w: 16, h: 4 },
  pole:         { kind: "pole",         label: "Pole",          color: "#f59e0b", w: 1, h: 6 },
  ladder:       { kind: "ladder",       label: "Agility ladder",color: "#94a3b8", w: 6, h: 20 },
  hurdle:       { kind: "hurdle",       label: "Hurdle",        color: "#f43f5e", w: 4, h: 2 },
  "ball-cluster": { kind: "ball-cluster", label: "Ball cluster", color: "#f8fafc", w: 4, h: 4 },
  bib:          { kind: "bib",          label: "Bib marker",    color: "#a3e635", w: 2, h: 2 },
};

/** A placed piece of equipment on the board. New, additive key — a play
 * saved before equipment existed has no `objects` array, and every reader
 * treats that the same as an empty one. */
export interface BoardObject {
  id: string;
  kind: EquipmentKind;
  x: number;
  y: number;
  /** degrees, for equipment that has a facing (goals, hurdles, poles). */
  rotation?: number;
}

// ── Roster / formation assignment ───────────────────────────────
//
// Moved out of tactical-board.tsx so board/page.tsx's roster loading and any
// other future formation-driven UI (e.g. the AI-suggested-XI Apply flow)
// can reuse the same types and assignment logic instead of redefining them.

export interface BoardPlayer {
  id: string;
  full_name: string;
  position: string | null;
}
export interface BoardTeam {
  id: string;
  name: string;
  age_group: string | null;
  players: BoardPlayer[];
}

/** A position's broad group (Goalkeeper/Defender/Midfielder/Forward),
 * falling back to Midfielder for a null/unrecognised position rather than
 * leaving a player ungrouped. */
export function groupOf(position: string | null): string {
  if (!position) return "Midfielder";
  return POSITIONS.find((p) => p.value === position)?.group ?? "Midfielder";
}

/** A short display label for a token: the player's first name, truncated. */
export function shortLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 9 ? first.slice(0, 8) + "…" : first;
}

let idc = 0;
/** A short, session-unique id with the given prefix (e.g. "t-1", "t-2"). */
export const uid = (p: string) => `${p}-${++idc}`;

/**
 * Assign real players to formation slots: exact position match first, then
 * same position group, then whoever is left — so a right back lands at right
 * back rather than wherever the list order happens to put them.
 */
export function assignToSlots(formation: Formation, roster: BoardPlayer[]): (BoardPlayer | undefined)[] {
  const pool = [...roster];
  const out: (BoardPlayer | undefined)[] = new Array(formation.slots.length).fill(undefined);

  const take = (pred: (p: BoardPlayer) => boolean) => {
    const i = pool.findIndex(pred);
    return i === -1 ? undefined : pool.splice(i, 1)[0];
  };

  formation.slots.forEach((slot, i) => {
    const p = take((pl) => pl.position === slot.role);
    if (p) out[i] = p;
  });
  formation.slots.forEach((slot, i) => {
    if (out[i]) return;
    const p = take((pl) => groupOf(pl.position) === groupOf(slot.role));
    if (p) out[i] = p;
  });
  formation.slots.forEach((_, i) => {
    if (out[i]) return;
    out[i] = pool.shift();
  });
  return out;
}

/**
 * Squeeze a full-pitch formation slot into one half, so two teams can be shown
 * facing each other. Home keeps the bottom half, away is mirrored into the top.
 * GK sits deepest, the furthest forward player sits nearest halfway.
 */
export function compress(slot: { x: number; y: number }, side: "home" | "away"): { x: number; y: number } {
  const DEEPEST = 142, HIGHEST = 38; // y range formations actually use
  const t = Math.max(0, Math.min(1, (DEEPEST - slot.y) / (DEEPEST - HIGHEST)));
  return side === "home"
    ? { x: slot.x, y: 146 - t * 68 }        // 146 (own goal) → 78 (just short of halfway)
    : { x: BOARD_W - slot.x, y: 4 + t * 68 };     // 4 (their goal) → 72, mirrored across
}

/**
 * Best-effort match of a freeform AI-suggested position label (e.g. "Right
 * Back", "Right Back (RB)", "CB", "Striker") to a real POSITIONS value.
 * Tried in order: exact value match, label match with the "(ABBR)" suffix
 * stripped, then the abbreviation pulled out of the raw text's own
 * parentheses. Returns null when nothing matches, rather than guessing —
 * the caller (mapNamedPositionsToSlots) treats that the same as any other
 * unmatched slot and falls through to its own leftover-fill pass.
 */
function normalizePositionLabel(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  const byValue = POSITIONS.find((p) => p.value.toLowerCase() === s);
  if (byValue) return byValue.value;

  const byLabel = POSITIONS.find(
    (p) => p.label.toLowerCase().replace(/\s*\([^)]*\)\s*/g, "").trim() === s
  );
  if (byLabel) return byLabel.value;

  const abbrevMatch = raw.match(/\(([A-Za-z]+)\)/);
  if (abbrevMatch) {
    const abbrev = abbrevMatch[1].toLowerCase();
    const byAbbrev = POSITIONS.find((p) => p.value.toLowerCase() === abbrev);
    if (byAbbrev) return byAbbrev.value;
  }
  return null;
}

/**
 * Places AI-suggested-XI picks (a freeform position label plus an
 * already-resolved player id — see the Apply flow in
 * coach-assistant-panel.tsx) onto a formation's slots. Reuses
 * assignToSlots' exact exact-role -> same-group -> leftover cascade, first
 * normalising each pick's freeform label to a real POSITIONS value so a
 * label like "Right Back" (which would never exact-match a slot's "rb"
 * role code, nor group-match anything since groupOf falls back to
 * Midfielder for unrecognised text) still lands as a Defender rather than
 * being shoved to a leftover slot ahead of players who actually needed one.
 *
 * Returns one entry per formation slot: the assigned pick's playerId, or
 * undefined if the roster of picks ran out before this slot was filled.
 */
export function mapNamedPositionsToSlots(
  formation: Formation,
  picks: { position: string; playerId: string }[]
): (string | undefined)[] {
  const asRoster: BoardPlayer[] = picks.map((p) => ({
    id: p.playerId,
    full_name: "",
    position: normalizePositionLabel(p.position),
  }));
  return assignToSlots(formation, asRoster).map((p) => p?.id);
}
