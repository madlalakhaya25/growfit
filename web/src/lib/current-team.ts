/**
 * One place "which team is this coach currently looking at" gets decided.
 *
 * Before this, four different surfaces each guessed independently: the
 * `TeamSwitcher` defaulted to the first team in *its own* name-ordered
 * fetch, the squad/fixtures/training pages each defaulted to the first team
 * in *their own* created_at-ordered fetch, the quick-actions "+" button
 * always pre-scoped to `teams[0]` regardless of what page it was opened
 * from (so it could silently create a fixture for the wrong team), and the
 * coach assistant panel kept its own separate `teamId` state. Four guesses
 * that usually agreed by coincidence and occasionally didn't.
 *
 * Precedence: an explicit `?team=` param, then the last team the coach
 * explicitly chose (the cookie `TeamSwitcher` sets on change), then the
 * first team in the caller's own array. Callers are expected to fetch teams
 * in one defined default order (created_at, oldest first) rather than each
 * picking their own — this module doesn't sort, it only picks from what
 * it's given.
 */

export const CURRENT_TEAM_COOKIE = "growfit-current-team";

export interface TeamLike {
  id: string;
}

export function resolveCurrentTeamId(
  teams: TeamLike[],
  teamParam?: string | null,
  cookieTeamId?: string | null
): string | null {
  if (!teams.length) return null;
  if (teamParam && teams.some((t) => t.id === teamParam)) return teamParam;
  if (cookieTeamId && teams.some((t) => t.id === cookieTeamId)) return cookieTeamId;
  return teams[0].id;
}

export function resolveCurrentTeam<T extends TeamLike>(
  teams: T[],
  teamParam?: string | null,
  cookieTeamId?: string | null
): T | null {
  const id = resolveCurrentTeamId(teams, teamParam, cookieTeamId);
  return id ? teams.find((t) => t.id === id) ?? null : null;
}

/**
 * Client-only cookie helpers for `TeamSwitcher` and any other client
 * component that needs to read or set the coach's last-chosen team. Reads
 * return `null` on the server (no `document`) rather than throwing, so a
 * component can call these unconditionally during render.
 */
export function readCurrentTeamCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CURRENT_TEAM_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function writeCurrentTeamCookie(teamId: string): void {
  if (typeof document === "undefined") return;
  const oneYearSeconds = 60 * 60 * 24 * 365;
  document.cookie = `${CURRENT_TEAM_COOKIE}=${encodeURIComponent(teamId)}; path=/; max-age=${oneYearSeconds}; SameSite=Lax`;
}
