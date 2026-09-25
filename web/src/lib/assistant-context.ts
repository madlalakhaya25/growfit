import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantTeam, AssistantFixture } from "@/components/ai/coach-assistant-panel";
import type { BoardPlayer } from "@/lib/board-model";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { reportError } from "@/lib/report-error";

export interface AssistantContext {
  teams: AssistantTeam[];
  roster: Record<string, BoardPlayer[]>;
  fixtures: Record<string, AssistantFixture[]>;
  /**
   * True when a query behind this context failed. Callers must check this
   * before treating an empty `teams`/`fixtures` as "no teams yet" — a
   * failed read looks identical to a genuinely empty account otherwise,
   * which is exactly how "Today can lie" bugs happen.
   */
  error: boolean;
}

type MemberRow = {
  active: boolean;
  players: { id: string; full_name: string; position: string | null } | { id: string; full_name: string; position: string | null }[] | null;
};
type TeamWithRosterRow = {
  id: string;
  team_members: MemberRow[] | null;
};

/**
 * Everything the coach assistant needs — a coach's teams, each team's
 * current roster, and upcoming fixtures per team — in one place. Extracted
 * from `coach/assistant/page.tsx` (the dedicated assistant page still uses
 * it directly) so the "Ask Growfit" header sheet (`ask-growfit-sheet.tsx`)
 * can fetch the exact same shape through a server action, on demand,
 * instead of duplicating this query on every coach page load.
 */
export async function getAssistantContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<AssistantContext> {
  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, age_group, team_members(active, players(id, full_name, position))")
    .in("id", await getCoachedTeamIds(supabase, userId))
    .eq("active", true)
    .order("name");

  if (teamsError) {
    reportError(teamsError, { scope: "getAssistantContext", extra: { query: "teams" } });
  }

  const teams = (teamRows ?? []) as (AssistantTeam & TeamWithRosterRow)[];

  const roster: Record<string, BoardPlayer[]> = {};
  for (const t of teams) {
    roster[t.id] = (t.team_members ?? [])
      .filter((m) => m.active && m.players)
      .flatMap((m) => (Array.isArray(m.players) ? m.players : [m.players!]))
      .map((p) => ({ id: p.id, full_name: p.full_name, position: p.position }));
  }

  const fixtures: Record<string, AssistantFixture[]> = {};
  let fixturesError: unknown = null;
  if (teams.length > 0) {
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const { data: fx, error } = await supabase
      .from("fixtures")
      .select("id, team_id, opponent, fixture_date, is_home")
      .in("team_id", teams.map((t) => t.id))
      .eq("status", "upcoming")
      .gte("fixture_date", since)
      .order("fixture_date", { ascending: true })
      .limit(40);
    fixturesError = error;
    if (fixturesError) {
      reportError(fixturesError, { scope: "getAssistantContext", extra: { query: "fixtures" } });
    }

    for (const f of (fx ?? []) as { id: string; team_id: string; opponent: string; fixture_date: string; is_home: boolean }[]) {
      (fixtures[f.team_id] ??= []).push({
        id: f.id,
        label: f.is_home ? `vs ${f.opponent}` : `away to ${f.opponent}`,
        when: new Date(f.fixture_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }),
      });
    }
  }

  return {
    teams: teams.map(({ id, name, age_group }) => ({ id, name, age_group })),
    roster,
    fixtures,
    error: Boolean(teamsError || fixturesError),
  };
}
