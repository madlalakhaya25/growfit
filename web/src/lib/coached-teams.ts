import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The teams a coach may work with.
 *
 * A team used to have exactly one coach (teams.coach_id), so every query
 * filtered on it directly. Teams can now have several — a technical director
 * across all age groups alongside the age-group coach — so membership lives in
 * team_coaches and queries filter by these ids instead.
 *
 * teams.coach_id still marks the head coach, and is kept in step by the
 * database functions in migration 019.
 */
export async function getCoachedTeamIds(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("coach_id", userId);

  return ((data ?? []) as { team_id: string }[]).map((r) => r.team_id);
}
