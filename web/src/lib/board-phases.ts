// In and out of possession shapes for our team (the Football Manager idea).
//
// A play's live tokens are always the shape of the phase that is showing.
// The other phase's layout is kept beside them as plain {id, x, y} rows for
// our own players only — opponents and the ball stay where they are when a
// coach flips between "With the ball" and "Without the ball".
//
// Setting both teams up from formations also stores the formation as named
// ("Formation"), plus both teams' shape with the ball and without it. Our
// opponents move with ours, so flipping shows the attack against a team
// defending, and the defence against a team attacking.
//
// It travels inside the play's existing saved JSON (and the board's undo
// history and local draft) as `phases`. A play saved before this existed has
// no `phases` at all and loads exactly as before: it is showing "With the
// ball", and "Without the ball" starts as a copy of it the first time it is
// opened. Pure functions only — no React, no DOM.

import type { Frame, Token } from "@/lib/board-model";

export type Phase = "base" | "with" | "without";

export const PHASES: readonly { id: Phase; label: string }[] = [
  { id: "base", label: "Formation" },
  { id: "with", label: "With the ball" },
  { id: "without", label: "Without the ball" },
];

/** The shapes a board offers: "Formation" only exists once the two teams
 * were set up from formations, which is when it has a layout to go back to. */
export function phaseOptions(phases: PhaseShapes | undefined): readonly { id: Phase; label: string }[] {
  return PHASES.filter((p) => p.id !== "base" || phases?.base || phases?.active === "base");
}

export interface PhasePosition {
  id: string;
  x: number;
  y: number;
}

export interface PhaseShapes {
  /** Which phase the live tokens are showing. */
  active: Phase;
  /** Our players' layout for each phase. The active phase's copy can be
   * stale (the live tokens are the truth); the other one is what flipping
   * to it brings back. Missing means "never opened yet". */
  with?: PhasePosition[];
  without?: PhasePosition[];
  /** The formation as named, before either team took an attacking or
   * defending shape. Only boards set up from formations have one. */
  base?: PhasePosition[];
}

/** Time a flip takes to glide from one shape to the other. */
export const PHASE_GLIDE_MS = 700;

/** The phase showing, for a board that may predate phases. */
export function activePhase(phases: PhaseShapes | undefined): Phase {
  return phases?.active ?? "with";
}

/** Our players and the opposition - the tokens a phase moves. The ball and
 * equipment stay where they are. */
export function shapeOf(tokens: readonly Pick<Token, "id" | "x" | "y" | "kind">[]): PhasePosition[] {
  return tokens.filter((t) => t.kind === "player" || t.kind === "opponent").map((t) => ({ id: t.id, x: t.x, y: t.y }));
}

/** Put tokens into a stored shape. Tokens the shape doesn't know (an
 * opponent, the ball, a player added since) keep where they are. */
export function applyShape<T extends Pick<Token, "id" | "x" | "y">>(tokens: readonly T[], shape: readonly PhasePosition[]): T[] {
  const byId = new Map(shape.map((p) => [p.id, p]));
  return tokens.map((t) => {
    const p = byId.get(t.id);
    return p ? { ...t, x: p.x, y: p.y } : t;
  });
}

/**
 * Flip the board to `target`. The live layout is stored as the phase being
 * left; the target's stored layout comes back, or — first time it's opened —
 * a copy of the current one, so the coach starts from the shape they have.
 */
export function switchPhase<T extends Pick<Token, "id" | "x" | "y" | "kind">>(
  tokens: readonly T[],
  phases: PhaseShapes | undefined,
  target: Phase
): { tokens: T[]; phases: PhaseShapes } {
  const current = activePhase(phases);
  const live = shapeOf(tokens);
  if (current === target) {
    return { tokens: [...tokens], phases: { ...phases, active: current, [current]: live } };
  }
  const targetShape = phases?.[target] ?? live;
  return {
    tokens: applyShape(tokens, targetShape),
    phases: { ...phases, [current]: live, [target]: targetShape, active: target },
  };
}

/** Both phases up to date with the live tokens — what a save writes.
 * Undefined stays undefined, so a play nobody flipped saves as it always did. */
export function phasesForSave(
  tokens: readonly Pick<Token, "id" | "x" | "y" | "kind">[],
  phases: PhaseShapes | undefined
): PhaseShapes | undefined {
  if (!phases) return undefined;
  return { ...phases, [phases.active]: shapeOf(tokens) };
}

function isPosition(v: unknown): v is PhasePosition {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === "string" && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function readShape(v: unknown): PhasePosition[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter(isPosition).map((p) => ({ id: p.id, x: p.x, y: p.y }));
}

/** Read `phases` back out of saved JSON written months apart by different
 * code. Anything unreadable is treated as an old play: no phases. */
export function readPhases(raw: unknown): PhaseShapes | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (r.active !== "base" && r.active !== "with" && r.active !== "without") return undefined;
  const out: PhaseShapes = { active: r.active };
  const withShape = readShape(r.with);
  const withoutShape = readShape(r.without);
  const baseShape = readShape(r.base);
  if (withShape) out.with = withShape;
  if (withoutShape) out.without = withoutShape;
  if (baseShape) out.base = baseShape;
  return out;
}

/** The two-step sequence that glides tokens from one phase to the other —
 * fed to the board's existing playback (interpolateFrames), so a flip moves
 * exactly the way a played step does. */
export function phaseGlideFrames(
  from: readonly Pick<Token, "id" | "x" | "y">[],
  to: readonly Pick<Token, "id" | "x" | "y">[],
  shapes: Frame["shapes"]
): Frame[] {
  const pos = (ts: readonly Pick<Token, "id" | "x" | "y">[]) => ts.map((t) => ({ id: t.id, x: t.x, y: t.y }));
  return [
    { id: "phase-from", tokens: pos(from), shapes },
    { id: "phase-to", tokens: pos(to), shapes, durationMs: PHASE_GLIDE_MS, ease: "ease-in-out" },
  ];
}

/** What a board set up from two formations stores: the formation as named,
 * and both teams' shapes for each phase. `layouts` are the home team's phase
 * (the away team takes the opposite one) as laid out by layoutTeams. */
export function phasesFromLayouts(
  ids: { home: readonly string[]; away: readonly string[] },
  layouts: Record<"base" | "attack" | "defend", { home: readonly { x: number; y: number }[]; away: readonly { x: number; y: number }[] }>
): PhaseShapes {
  const shape = (l: { home: readonly { x: number; y: number }[]; away: readonly { x: number; y: number }[] }): PhasePosition[] => [
    ...ids.home.map((id, i) => ({ id, x: l.home[i].x, y: l.home[i].y })),
    ...ids.away.map((id, i) => ({ id, x: l.away[i].x, y: l.away[i].y })),
  ];
  return { active: "base", base: shape(layouts.base), with: shape(layouts.attack), without: shape(layouts.defend) };
}

/** The two moves of "show me both shapes": from the formation into the attack,
 * then into the defence. Returns frames for the board's playback. */
export function phaseTourFrames(
  phases: PhaseShapes,
  tokens: readonly Pick<Token, "id" | "x" | "y">[],
  shapes: Frame["shapes"]
): Frame[] {
  const stops = [phases.base, phases.with, phases.without].filter((s): s is PhasePosition[] => Boolean(s));
  const at = (shape: readonly PhasePosition[]) => applyShape(tokens, shape).map((t) => ({ id: t.id, x: t.x, y: t.y }));
  return stops.map((shape, i) => ({
    id: `tour-${i}`,
    tokens: at(shape),
    shapes,
    ...(i === 0 ? {} : { durationMs: PHASE_TOUR_MS, ease: "ease-in-out" as const }),
  }));
}

/** Time each move of the tour takes. */
export const PHASE_TOUR_MS = 1600;
