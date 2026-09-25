import "server-only";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE, resolveCurrentTeam, type TeamLike } from "@/lib/current-team";

/**
 * Server Component convenience wrapper around `resolveCurrentTeam` — reads
 * the cookie `TeamSwitcher` sets and resolves it in one call, instead of
 * every page repeating the same `cookies().get(...)` + `resolveCurrentTeam`
 * pair. Kept out of `lib/current-team.ts` itself so that file stays safe to
 * import from a Client Component (`next/headers` cannot be, even unused).
 */
export async function resolveCurrentTeamFromCookies<T extends TeamLike>(
  teams: T[],
  teamParam?: string | null
): Promise<T | null> {
  const cookieTeamId = (await cookies()).get(CURRENT_TEAM_COOKIE)?.value ?? null;
  return resolveCurrentTeam(teams, teamParam, cookieTeamId);
}
