import { asRecord, boundedInt, fixtureHref, isUuid, scopedTeamIds } from "./shared";
import type { AgentTool } from "./types";

type Status = "upcoming" | "completed";
interface Input { teamId?: string; status?: Status; limit: number }
interface Row {
  fixtureId: string; team: string; opponent: string; date: string; venue: string | null;
  isHome: boolean; status: string; score: { team: number; opponent: number } | null; href?: string;
}
type Output = { fixtures: Row[] };

type FixtureRow = {
  id: string; opponent: string; fixture_date: string; venue: string | null; is_home: boolean; status: string;
  teams: { name: string } | { name: string }[] | null;
  match_results: { team_score: number; opponent_score: number } | { team_score: number; opponent_score: number }[] | null;
};
const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export const getFixtures: AgentTool<Input, Output> = {
  name: "getFixtures",
  description: "Returns fixtures for the caller's teams, with the score for completed ones.",
  parameters: {
    type: "object",
    properties: {
      teamId: { type: "string", description: "Optional team id." },
      status: { type: "string", enum: ["upcoming", "completed"], description: "Optional filter." },
      limit: { type: "integer", description: "Max fixtures, 1 to 20. Defaults to 10." },
    },
  },
  maxRows: 20,
  parseInput(raw) {
    const r = asRecord(raw ?? {});
    if (!r) return null;
    if (r.teamId != null && !isUuid(r.teamId)) return null;
    if (r.status != null && r.status !== "upcoming" && r.status !== "completed") return null;
    const limit = boundedInt(r.limit, { min: 1, max: 20, fallback: 10 });
    if (limit === undefined) return null;
    return {
      teamId: (r.teamId as string | undefined) ?? undefined,
      status: (r.status as Status | undefined) ?? undefined,
      limit,
    };
  },
  async run(ctx, input) {
    const teamIds = scopedTeamIds(ctx, input.teamId);
    if (!teamIds.length) return { fixtures: [] };
    let q = ctx.supabase
      .from("fixtures")
      .select("id, opponent, fixture_date, venue, is_home, status, teams ( name ), match_results ( team_score, opponent_score )")
      .in("team_id", teamIds);
    if (input.status) q = q.eq("status", input.status);
    const { data, error } = await q
      .order("fixture_date", { ascending: input.status !== "completed" })
      .limit(Math.min(input.limit, getFixtures.maxRows));
    if (error) throw error;
    return {
      fixtures: ((data ?? []) as FixtureRow[]).map((f) => {
        const res = first(f.match_results);
        return {
          fixtureId: f.id,
          team: first(f.teams)?.name ?? "",
          opponent: f.opponent,
          date: f.fixture_date,
          venue: f.venue,
          isHome: f.is_home,
          status: f.status,
          score: res ? { team: res.team_score, opponent: res.opponent_score } : null,
          href: fixtureHref(ctx, f.id),
        };
      }),
    };
  },
  links: (o) => o.fixtures.filter((f) => f.href).map((f) => ({ label: `vs ${f.opponent}`, href: f.href!, match: [f.opponent] })),
};
