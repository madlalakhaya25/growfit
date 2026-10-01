import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canActOnPlayer } from "@/lib/auth-guards";
import type { UserRole } from "@/lib/types";

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
 *
 * Cached per request (React `cache()`) -- this ran 3x on Coach Today alone
 * (the protected layout's team switcher, the page's own team list, and
 * getWelfareAlerts, each a separate round trip for the exact same coach's
 * exact same teams). `cache()` keys on argument identity, not just `userId`,
 * so this only actually collapses those calls because `lib/supabase/server`'s
 * `createClient()` is itself cached per request now -- every caller's
 * `supabase` is the same object within one request, not a fresh client each
 * time.
 */
export const getCoachedTeamIds = cache(async function getCoachedTeamIds(
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
});

/**
 * True when this user may act on this player: an admin in the same academy, or
 * a coach of a team the player is an active member of. This is the boundary RLS
 * does NOT draw -- `player_academy_read` is academy-wide -- so every
 * player-scoped AI action calls it. The decision itself is the pure
 * `canActOnPlayer`; this only gathers its inputs.
 *
 * Fails closed: any query error reads as "no".
 */
export async function coachesPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { userId: string; role: UserRole; playerId: string }
): Promise<boolean> {
  const [{ data: player }, { data: me }, { data: memberships }, coachedTeamIds] = await Promise.all([
    supabase.from("players").select("academy_id").eq("id", input.playerId).single(),
    supabase.from("profiles").select("academy_id").eq("id", input.userId).single(),
    supabase.from("team_members").select("team_id").eq("player_id", input.playerId).eq("active", true),
    getCoachedTeamIds(supabase, input.userId),
  ]);
  if (!player) return false;
  return canActOnPlayer({
    role: input.role,
    userAcademyId: (me?.academy_id as string | null) ?? null,
    playerAcademyId: (player.academy_id as string | null) ?? null,
    coachedTeamIds,
    playerTeamIds: ((memberships ?? []) as { team_id: string }[]).map((m) => m.team_id),
  });
}
