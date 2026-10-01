import type { SupabaseClient } from "@supabase/supabase-js";
import { tallyOpponentFormations, type FormationTally } from "@/lib/opponent-counter";
import { selectMeetings, type Meeting, type OpponentFixtureRow } from "@/lib/opponent-memory";

/** Enough history to find every meeting with a long-standing league opponent. */
const FIXTURE_SCAN_LIMIT = 100;

/**
 * Loads what the academy already knows about `opponent`: past meetings and the
 * shape the opponent has been drawn in across saved plays. Reads under the
 * caller's own session; the caller has already authorised `teamId`.
 *
 * Meetings are matched in code by `normaliseOpponent` rather than with a SQL
 * `ilike`, because `ilike` is case-insensitive but not whitespace-insensitive,
 * and a stray double space is exactly how the same club ends up written twice.
 */
export async function loadOpponentMemory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { teamId: string; opponent: string; fixtureId: string }
): Promise<{ meetings: Meeting[]; formations: FormationTally[] }> {
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, opponent, fixture_date, is_home, status, match_results ( team_score, opponent_score, match_notes )")
    .eq("team_id", input.teamId)
    .eq("status", "completed")
    .order("fixture_date", { ascending: false })
    .limit(FIXTURE_SCAN_LIMIT);

  const meetings = selectMeetings((fixtures ?? []) as OpponentFixtureRow[], input.opponent, {
    excludeFixtureId: input.fixtureId,
  });

  // Only the two keys the tally needs, not whole play blobs.
  const { data: plays } = await supabase
    .from("tactic_plays")
    .select("awayFormationId:data->awayFormationId, tokens:data->tokens")
    .eq("team_id", input.teamId)
    .eq("surface", "pitch")
    .in("fixture_id", [...new Set([input.fixtureId, ...meetings.map((m) => m.fixtureId)])]);

  return {
    meetings,
    formations: tallyOpponentFormations((plays ?? []) as { awayFormationId?: unknown; tokens?: unknown }[]),
  };
}
