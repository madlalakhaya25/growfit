// A coach's words turned into runs on the board, with no coordinates from the
// model.
//
// "Left back overlaps, the 10 drops, strikers press" goes to the model, which
// answers with a short list of fixed actions and the players they apply to (by
// number in a list we gave it). This module is the pure half: what of that
// answer is believed (validateInstructions) and the deterministic movement each
// action means (planInstructions). The model never says where anyone ends up;
// the same action on the same board always draws the same run.
//
// Board space is 100 wide x 150 tall; our team attacks up the pitch (y falls)
// and a low x is the team's left. Kept out of the "use server" file so Jest can
// test it without @google/genai.

import { BOARD_H, BOARD_W, uid, type Shape, type Token } from "@/lib/board-model";

export const INSTRUCTION_ACTIONS = [
  "overlap", "underlap", "hold", "drop", "invert", "stay_wide", "attack_box", "press", "cover", "shift_across",
] as const;
export type InstructionAction = (typeof INSTRUCTION_ACTIONS)[number];

export type Direction = "left" | "right";

/** One thing the coach asked for. `player` (and `target`) are positions in the
 * list of our players the model was shown, never ids or coordinates. */
export interface Instruction {
  action: InstructionAction;
  player: number;
  /** overlap, underlap, cover: the teammate the run is made around. */
  target?: number;
  /** shift_across: which way the player slides. */
  direction?: Direction;
}

export const MAX_INSTRUCTIONS = 12;
export const MAX_INSTRUCTION_CHARS = 300;

/** What each action means, in the words a coach uses. Shown to the model and
 * in the preview. */
export const ACTION_HELP: Record<InstructionAction, string> = {
  overlap: "runs outside a teammate, past them down the flank (needs target; if omitted the nearest wide teammate ahead is used)",
  underlap: "runs inside a teammate, into the half-space (needs target; if omitted the nearest wide teammate ahead is used)",
  hold: "stays where they are and keeps the shape",
  drop: "drops deeper, toward their own goal",
  invert: "a wide player moves inside, into the middle",
  stay_wide: "a wide player holds the touchline to stretch the pitch",
  attack_box: "runs into the penalty area",
  press: "closes down the nearest opponent (or pushes up if there is no opponent on the board)",
  cover: "drops in behind and inside a teammate to cover for them (needs target)",
  shift_across: "slides sideways, left or right, with the ball (needs direction)",
};

export type InstructionResult =
  | { ok: true; instructions: Instruction[]; dropped: number }
  | { ok: false; error: string };

const ACTION_SET: ReadonlySet<string> = new Set(INSTRUCTION_ACTIONS);
const isIndex = (v: unknown, count: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < count;

/**
 * Believe only what the board can act on: a known action, a player that is
 * really in the list, a target that is a different player, a direction that is
 * left or right, and no more than MAX_INSTRUCTIONS. Anything else is dropped
 * and counted, never drawn.
 */
function readInstruction(item: unknown, playerCount: number): Instruction | null {
  const r = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
  if (!r || typeof r.action !== "string" || !ACTION_SET.has(r.action) || !isIndex(r.player, playerCount)) return null;
  const ins: Instruction = { action: r.action as InstructionAction, player: r.player };
  if (isIndex(r.target, playerCount) && r.target !== r.player) ins.target = r.target;
  if (r.direction === "left" || r.direction === "right") ins.direction = r.direction;
  if (ins.action === "cover" && ins.target === undefined) return null;
  if (ins.action === "shift_across" && !ins.direction) return null;
  return ins;
}

export function validateInstructions(raw: Record<string, unknown> | null, playerCount: number): InstructionResult {
  if (!raw) return { ok: false, error: "Could not read the AI's answer. Try rewording it." };
  const offered = Array.isArray(raw.instructions) ? raw.instructions : [];
  const out: Instruction[] = [];
  let dropped = 0;
  for (const item of offered) {
    const ins = out.length < MAX_INSTRUCTIONS ? readInstruction(item, playerCount) : null;
    if (ins) out.push(ins);
    else dropped++;
  }
  if (out.length === 0) {
    return { ok: false, error: "Couldn't find a movement in that. Try something like \"left back overlaps, the 10 drops\"." };
  }
  return { ok: true, instructions: out, dropped };
}

export interface PlannedInstruction {
  instruction: Instruction;
  /** The coach's action in words, for the preview: "LB overlaps LW". */
  text: string;
  /** The run it draws, if it moves anyone. Joined to the player's token. */
  shape?: Shape;
}

export interface InstructionPlan {
  planned: PlannedInstruction[];
  /** Instructions that could not be drawn on this board, each with why. */
  skipped: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ctx = (ins: Instruction, p: Token, mates: Token[], opponents: Token[], target: Token | null): Ctx => ({ ins, p, mates, opponents, target });
const MIN_RUN = 3;

/** -1 toward the left touchline, +1 toward the right: the way "outside" points
 * for a player standing at x. A player on the centre line counts as right. */
const outward = (x: number) => (x < BOARD_W / 2 ? -1 : 1);
const isCentral = (x: number) => Math.abs(x - BOARD_W / 2) < 10;
const name = (t: Token) => t.label || "Player";

/** The nearest teammate ahead of `p` on the same flank: who an overlap or
 * underlap is made around when the coach did not say. */
function wideTeammateAhead(p: Token, mates: Token[]): Token | null {
  let best: Token | null = null;
  let bestD = Infinity;
  for (const m of mates) {
    if (m.id === p.id || m.y >= p.y - 2 || isCentral(m.x) || outward(m.x) !== outward(p.x)) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < bestD) { best = m; bestD = d; }
  }
  return best;
}

function nearestOpponent(p: Token, opponents: Token[]): Token | null {
  let best: Token | null = null;
  let bestD = Infinity;
  for (const o of opponents) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bestD) { best = o; bestD = d; }
  }
  return best;
}

interface Move { to: { x: number; y: number }; kind: "run" | "press"; verb: string }

/** Everything a movement rule can look at. */
interface Ctx {
  ins: Instruction;
  p: Token;
  mates: Token[];
  opponents: Token[];
  target: Token | null;
}

type Rule = (c: Ctx) => Move | string;

const run = (verb: string, x: number, y: number): Move => ({ kind: "run", verb, to: { x, y } });
const lane = (x: number) => clamp(x, 6, BOARD_W - 6);
const row = (y: number) => clamp(y, 4, BOARD_H - 4);

/** The teammate an overlap or underlap is made around: the named one, else the
 * nearest wide teammate ahead. */
const aroundTeammate = (c: Ctx) => c.target ?? wideTeammateAhead(c.p, c.mates);

const RULES: Record<Exclude<InstructionAction, "hold">, Rule> = {
  overlap: (c) => {
    const t = aroundTeammate(c);
    if (!t) return `${name(c.p)} has nobody wide ahead to overlap. Name the player.`;
    const out = isCentral(t.x) ? outward(c.p.x) : outward(t.x);
    return run(`overlaps ${name(t)}`, lane(t.x + out * 7), row(t.y - 9));
  },
  underlap: (c) => {
    const t = aroundTeammate(c);
    if (!t) return `${name(c.p)} has nobody wide ahead to underlap. Name the player.`;
    const out = isCentral(t.x) ? outward(c.p.x) : outward(t.x);
    return run(`underlaps ${name(t)}`, lane(t.x - out * 9), row(t.y - 7));
  },
  drop: ({ p }) => run("drops deeper", p.x, clamp(p.y + 14, 4, BOARD_H - 14)),
  invert: ({ p }) => {
    if (isCentral(p.x)) return `${name(p)} is already in the middle.`;
    return run("moves inside", lane(p.x - outward(p.x) * 16), row(p.y - 4));
  },
  stay_wide: ({ p }) => {
    if (isCentral(p.x)) return `${name(p)} is in the middle, so there is no touchline to hold.`;
    return run("stays wide", outward(p.x) < 0 ? 8 : BOARD_W - 8, p.y);
  },
  attack_box: ({ p }) => run("attacks the box", 50 + clamp((p.x - 50) * 0.3, -12, 12), 18),
  press: ({ p, opponents }) => {
    const o = nearestOpponent(p, opponents);
    const to = o ? { x: p.x + (o.x - p.x) * 0.75, y: p.y + (o.y - p.y) * 0.75 } : { x: p.x, y: row(p.y - 14) };
    return { kind: "press", verb: "presses", to };
  },
  cover: ({ p, target }) => {
    if (!target) return `${name(p)} needs a teammate to cover.`;
    return run(`covers ${name(target)}`, lane(target.x + (BOARD_W / 2 - target.x) * 0.2), row(target.y + 10));
  },
  shift_across: ({ ins, p }) => run(`shifts ${ins.direction}`, lane(p.x + (ins.direction === "left" ? -12 : 12)), p.y),
};

/**
 * The runs a list of instructions draws on this board. `players` is the same
 * list (same order) the model was shown; `opponents` are the other team's
 * tokens. Pure and deterministic: nothing here reads the clock or a random
 * number except the shape ids.
 */
export function planInstructions(players: Token[], opponents: Token[], instructions: Instruction[]): InstructionPlan {
  const planned: PlannedInstruction[] = [];
  const skipped: string[] = [];
  for (const ins of instructions) {
    const p = players[ins.player];
    if (!p) continue;
    if (ins.action === "hold") {
      planned.push({ instruction: ins, text: `${name(p)} holds position` });
      continue;
    }
    const target = ins.target === undefined ? null : (players[ins.target] ?? null);
    const move = RULES[ins.action](ctx(ins, p, players, opponents, target));
    if (typeof move === "string") { skipped.push(move); continue; }
    const to = { x: Math.round(move.to.x * 10) / 10, y: Math.round(move.to.y * 10) / 10 };
    if (Math.hypot(to.x - p.x, to.y - p.y) < MIN_RUN) { skipped.push(`${name(p)} is already there, so there is no run to draw.`); continue; }
    planned.push({
      instruction: ins,
      text: `${name(p)} ${move.verb}`,
      shape: { id: uid("s"), kind: move.kind, pts: [{ x: p.x, y: p.y }, to], fromTokenId: p.id },
    });
  }
  return { planned, skipped };
}

/** The players as the model sees them: a number, the label on the token, the
 * line they play in, and where they stand in words. No coordinates. */
export function playersMenu(players: Token[]): string {
  return players.map((p, i) => `${i} = ${name(p)} (${p.group}, ${sideWord(p.x)}, ${thirdWord(p.y)})`).join("\n");
}

function thirdWord(y: number): string {
  if (y < 50) return "attacking third";
  return y < 100 ? "middle third" : "defensive third";
}

function sideWord(x: number): string {
  if (x < 33) return "left";
  return x > 67 ? "right" : "central";
}

/** What the model is told each action means, one per line. */
export function actionMenu(): string {
  return INSTRUCTION_ACTIONS.map((a) => `- ${a}: ${ACTION_HELP[a]}`).join("\n");
}

/** The preview's words, joined, saved with the play as what the coach asked for. */
export function instructionLine(sentence: string): string {
  return sentence.replace(/\s+/g, " ").trim().slice(0, MAX_INSTRUCTION_CHARS);
}

/** Read the coach's saved instructions back from a play's JSON. */
export function readInstructions(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const lines = v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(instructionLine);
  return lines.length ? lines.slice(0, 20) : undefined;
}
