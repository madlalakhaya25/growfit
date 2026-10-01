import { asRecord, DEFAULT_MAX_ROWS, isUuid, playerHref, scopedTeamIds } from "./shared";
import type { AgentTool } from "./types";

interface Input { teamId?: string }
interface Row { playerId: string; name: string; team: string; position: string | null; href?: string }
interface Output { players: Row[]; truncated: boolean }

type Member = {
  team_id: string;
  teams: { name: string } | { name: string }[] | null;
  players: { id: string; full_name: string; position: string | null } | { id: string; full_name: string; position: string | null }[] | null;
};
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Roster of the caller's teams. Names and positions only — nothing sensitive. */
export const getSquad: AgentTool<Input, Output> = {
  name: "getSquad",
  description: "Lists the active players on the caller's teams with their team and position.",
  parameters: {
    type: "object",
    properties: { teamId: { type: "string", description: "Optional team id to narrow to one team." } },
  },
  maxRows: DEFAULT_MAX_ROWS,
  parseInput(raw) {
    const r = asRecord(raw ?? {});
    if (!r) return null;
    if (r.teamId === undefined || r.teamId === null) return {};
    return isUuid(r.teamId) ? { teamId: r.teamId } : null;
  },
  async run(ctx, input) {
    const teamIds = scopedTeamIds(ctx, input.teamId);
    if (!teamIds.length) return { players: [], truncated: false };
    const { data, error } = await ctx.supabase
      .from("team_members")
      .select("team_id, teams ( name ), players ( id, full_name, position )")
      .in("team_id", teamIds)
      .eq("active", true)
      .limit(getSquad.maxRows + 1);
    if (error) throw error;
    const rows: Row[] = [];
    for (const m of (data ?? []) as Member[]) {
      const p = one(m.players);
      if (!p) continue;
      rows.push({
        playerId: p.id,
        name: p.full_name,
        team: one(m.teams)?.name ?? "",
        position: p.position,
        href: playerHref(ctx, p.id),
      });
    }
    return { players: rows.slice(0, getSquad.maxRows), truncated: rows.length > getSquad.maxRows };
  },
  links: (o) => o.players.filter((p) => p.href).map((p) => ({ label: p.name, href: p.href!, match: [p.name] })),
};
