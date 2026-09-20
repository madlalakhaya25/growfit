import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The teams a coach may work with.
 *
 * A team used to have exactly one coach (teams.coach_id), so every query
 * filtered on it directly. Teams can now have several — a technical director
 * across all age groups alongside the age-group coach — so membership lives in
 * team_coaches and queries filter by these ids instead.
 *
 * Falls back to teams.coach_id when team_coaches is missing, so the app keeps
 * working if the code is deployed before migration 019 is applied. Without that
 * fallback a missing table silently returns no teams, which reads as "you have
 * no teams" rather than "the database is behind".
 */
export async function getCoachedTeamIds(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("coach_id", userId);

  if (!error) {
    return ((data ?? []) as { team_id: string }[]).map((r) => r.team_id);
  }

  // Migration 019 not applied yet — read the single-coach column instead.
  const { data: legacy } = await supabase
    .from("teams")
    .select("id")
    .eq("coach_id", userId)
    .eq("active", true);

  return ((legacy ?? []) as { id: string }[]).map((r) => r.id);
}
