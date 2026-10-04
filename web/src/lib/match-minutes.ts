import type { SupabaseClient } from "@supabase/supabase-js";

/** Upper bound on minutes saved for one match (extra time and all). Matches migration 062's check. */
export const MAX_MATCH_MINUTES = 150;

export interface SeasonMinutes {
  minutes: number;
  matches: number;
}

type Row = { player_id: string; minutes_played: number | null };

/** Total recorded minutes and matches per player. Rows with no minutes are skipped. */
export function sumSeasonMinutes(rows: readonly Row[]): Map<string, SeasonMinutes> {
  return rows.reduce((acc, row) => {
    if (row.minutes_played === null || row.minutes_played === undefined) return acc;
    const prev = acc.get(row.player_id) ?? { minutes: 0, matches: 0 };
    acc.set(row.player_id, {
      minutes: prev.minutes + row.minutes_played,
      matches: prev.matches + (row.minutes_played > 0 ? 1 : 0),
    });
    return acc;
  }, new Map<string, SeasonMinutes>());
}

/**
 * Minutes played this season (calendar year, the academy's season) for some
 * players. `available: false` until migration 062 adds the column, so a caller
 * just shows nothing rather than an error.
 */
export async function loadSeasonMinutes(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerIds: string[],
  season: string,
): Promise<{ available: boolean; byPlayer: Map<string, SeasonMinutes> }> {
  if (playerIds.length === 0) return { available: true, byPlayer: new Map() };
  const year = Number(season);
  const { data, error } = await supabase
    .from("match_appearances")
    .select("player_id, minutes_played, fixtures!inner ( fixture_date )")
    .in("player_id", playerIds)
    .not("minutes_played", "is", null)
    .gte("fixtures.fixture_date", `${year}-01-01`)
    .lt("fixtures.fixture_date", `${year + 1}-01-01`);
  if (error) return { available: false, byPlayer: new Map() };
  return { available: true, byPlayer: sumSeasonMinutes((data ?? []) as Row[]) };
}
