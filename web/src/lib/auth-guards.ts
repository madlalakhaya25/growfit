import type { UserRole } from "@/lib/types";

/**
 * Pure access rules, kept apart from `lib/auth.ts` (which imports the
 * request-bound Supabase client and `next/navigation`) so they can be unit
 * tested without either. The queries that feed them live in `lib/auth.ts` and
 * `lib/coached-teams.ts`.
 */

/** Coach and admin are "staff": the only roles that may call a player-scoped AI action. */
export function isStaffRole(role: UserRole | string | null | undefined): role is "admin" | "coach" {
  return role === "admin" || role === "coach";
}

/**
 * May this user act on this player?
 *
 * RLS does NOT draw this line: `player_academy_read` (migration 001) lets any
 * signed-in member of the academy -- player and parent included -- read any
 * player row in it. So the per-player boundary is an app-level one, the same
 * reason `requireCoachTeam` exists in `app/actions/match-plans.ts`.
 *
 *  - admin: any player in their own academy;
 *  - coach: a player on a team the coach is on. A coach of a *different* team
 *    in the same academy is refused -- RLS would have let them read it, which
 *    is exactly why this check is needed;
 *  - player / parent / anything else: never.
 *
 * An unknown academy on either side fails closed rather than matching two
 * nulls.
 */
export function canActOnPlayer(input: {
  role: UserRole | string | null | undefined;
  userAcademyId: string | null;
  playerAcademyId: string | null;
  coachedTeamIds: readonly string[];
  playerTeamIds: readonly string[];
}): boolean {
  if (!isStaffRole(input.role)) return false;
  if (!input.userAcademyId || !input.playerAcademyId) return false;
  if (input.userAcademyId !== input.playerAcademyId) return false;
  if (input.role === "admin") return true;
  const coached = new Set(input.coachedTeamIds);
  return input.playerTeamIds.some((id) => coached.has(id));
}
