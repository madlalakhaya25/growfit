// Reading a player's positions (migration 066). A missing table reads as
// "not available", never as an error: the editor then hides itself and every
// screen keeps using players.position as it always has.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isRoleFor, type PositionSlot } from "@/lib/player-roles";

export type PositionKind = "official" | "preferred";

export interface PlayerPositions {
  available: boolean;
  official: PositionSlot[];
  preferred: PositionSlot[];
}

/** PGRST205 / 42P01: the table is not there yet. Not the column codes. */
export function isMissingPositionsTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

interface Row { kind: string; rank: number; position: string; role: string | null }

export function slotsFromRows(rows: readonly Row[], kind: PositionKind): PositionSlot[] {
  return rows
    .filter((r) => r.kind === kind)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({ position: r.position, role: isRoleFor(r.position, r.role) ? r.role : null }));
}

export async function getPlayerPositions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string
): Promise<PlayerPositions> {
  const { data, error } = await supabase
    .from("player_positions")
    .select("kind, rank, position, role")
    .eq("player_id", playerId);
  if (error) return { available: !isMissingPositionsTable(error), official: [], preferred: [] };
  const rows = (data ?? []) as Row[];
  return { available: true, official: slotsFromRows(rows, "official"), preferred: slotsFromRows(rows, "preferred") };
}
