// The role a player has inside a position ("Box-to-box" for a central
// midfielder, "Inverted" for a full back), and the three position slots a
// player can hold (main, second, third).
//
// Pure data and checks, shared by the editor, the Server Actions and the
// attribute presets. Role ids are stored in `player_positions.role`, so an id
// is never renamed once shipped; change the label instead.

import { POSITIONS } from "@/lib/types";

/** The 17 granular positions a player can be given. The five legacy values
 * (goalkeeper, defender, ...) stay readable but are never offered. */
export const PICKABLE_POSITIONS = POSITIONS.filter((p) => p.value.length <= 3);
const PICKABLE = new Set<string>(PICKABLE_POSITIONS.map((p) => p.value));

export const MAX_POSITION_SLOTS = 3;

export const ROLES = {
  shot_stopper: "Shot-stopper",
  sweeper_keeper: "Sweeper keeper",
  stopper: "Stopper",
  ball_playing: "Ball-playing",
  cover: "Cover",
  overlapping: "Overlapping",
  inverted: "Inverted",
  defensive: "Defensive",
  anchor: "Anchor",
  deep_playmaker: "Deep playmaker",
  ball_winner: "Ball winner",
  box_to_box: "Box-to-box",
  half_space_runner: "Half-space runner",
  playmaker: "Playmaker",
  classic_10: "Classic 10",
  shadow_striker: "Shadow striker",
  touchline_winger: "Touchline winger",
  inside_forward: "Inside forward",
  wide_playmaker: "Wide playmaker",
  target: "Target",
  poacher: "Poacher",
  false_9: "False 9",
  pressing_forward: "Pressing forward",
} as const;
export type RoleId = keyof typeof ROLES;

const KEEPER: RoleId[] = ["shot_stopper", "sweeper_keeper"];
const CENTRE_BACK: RoleId[] = ["stopper", "ball_playing", "cover"];
const FULL_BACK: RoleId[] = ["overlapping", "inverted", "defensive"];
const DEFENSIVE_MID: RoleId[] = ["anchor", "deep_playmaker", "ball_winner"];
const CENTRAL_MID: RoleId[] = ["box_to_box", "half_space_runner", "playmaker"];
const ATTACKING_MID: RoleId[] = ["classic_10", "shadow_striker"];
const WINGER: RoleId[] = ["touchline_winger", "inside_forward", "wide_playmaker"];
const STRIKER: RoleId[] = ["target", "poacher", "false_9", "pressing_forward"];

const ROLES_BY_POSITION: Record<string, RoleId[]> = {
  gk: KEEPER,
  cb: CENTRE_BACK, sw: CENTRE_BACK,
  lb: FULL_BACK, rb: FULL_BACK, lwb: FULL_BACK, rwb: FULL_BACK,
  cdm: DEFENSIVE_MID,
  cm: CENTRAL_MID,
  lm: WINGER, rm: WINGER,
  cam: ATTACKING_MID,
  lw: WINGER, rw: WINGER,
  ss: STRIKER, cf: STRIKER, st: STRIKER,
};

export function isPickablePosition(position: unknown): position is string {
  return typeof position === "string" && PICKABLE.has(position);
}

/** The roles on offer for a position; empty for one that has none. */
export function rolesFor(position: string | null | undefined): { id: RoleId; label: string }[] {
  return (ROLES_BY_POSITION[position ?? ""] ?? []).map((id) => ({ id, label: ROLES[id] }));
}

export function isRoleFor(position: string, role: unknown): role is RoleId {
  return typeof role === "string" && (ROLES_BY_POSITION[position] ?? []).includes(role as RoleId);
}

export function roleLabel(role: string | null | undefined): string | null {
  return role && role in ROLES ? ROLES[role as RoleId] : null;
}

export function positionLabel(position: string | null | undefined): string {
  const full = POSITIONS.find((p) => p.value === position)?.label ?? "";
  return full.replace(/\s*\([A-Z]+\)$/, "") || "Not set";
}

/** One of a player's up to three slots. `role` is null when none is chosen. */
export interface PositionSlot {
  position: string;
  role: RoleId | null;
}

export type SlotsResult = { ok: true; slots: PositionSlot[] } | { ok: false; error: string };

/**
 * Believe only what can be stored: at most three slots, each a pickable
 * position, no position twice, and a role that belongs to that position.
 */
export function validateSlots(raw: unknown): SlotsResult {
  if (!Array.isArray(raw)) return { ok: false, error: "Choose at least one position." };
  if (raw.length > MAX_POSITION_SLOTS) return { ok: false, error: `Choose up to ${MAX_POSITION_SLOTS} positions.` };
  const slots: PositionSlot[] = [];
  for (const item of raw) {
    const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (!isPickablePosition(r.position)) return { ok: false, error: "That position isn't one we know." };
    if (slots.some((s) => s.position === r.position)) return { ok: false, error: "Each position can be picked once." };
    const role = r.role === null || r.role === undefined || r.role === "" ? null : r.role;
    if (role !== null && !isRoleFor(r.position, role)) return { ok: false, error: "That role doesn't fit the position." };
    slots.push({ position: r.position, role });
  }
  if (slots.length === 0) return { ok: false, error: "Choose at least one position." };
  return { ok: true, slots };
}
