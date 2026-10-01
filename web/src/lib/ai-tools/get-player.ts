import { asRecord, authorisePlayer, isUuid, NOT_YOUR_PLAYER, playerHref } from "./shared";
import type { AgentTool } from "./types";

interface Input { playerId: string }
type Output =
  | { error: string }
  | {
      playerId: string;
      name: string;
      position: string | null;
      secondaryPosition: string | null;
      preferredFoot: string | null;
      teams: string[];
      href?: string;
    };

/**
 * One player's football profile. Deliberately omits date of birth, photo,
 * share token and every contact or medical field — the model never needs them
 * and COACH_SYSTEM asks it not to repeat them anyway.
 */
export const getPlayer: AgentTool<Input, Output> = {
  name: "getPlayer",
  description: "Returns one player's name, positions, preferred foot and teams.",
  parameters: {
    type: "object",
    properties: { playerId: { type: "string", description: "The player's id." } },
    required: ["playerId"],
  },
  maxRows: 1,
  parseInput(raw) {
    const r = asRecord(raw);
    return r && isUuid(r.playerId) ? { playerId: r.playerId } : null;
  },
  async run(ctx, { playerId }) {
    if (!(await authorisePlayer(ctx, playerId))) return NOT_YOUR_PLAYER;
    const [{ data: p, error }, { data: tm }] = await Promise.all([
      ctx.supabase
        .from("players")
        .select("id, full_name, position, secondary_pos, preferred_foot")
        .eq("id", playerId)
        .single(),
      ctx.supabase.from("team_members").select("teams ( name )").eq("player_id", playerId).eq("active", true),
    ]);
    if (error || !p) throw error ?? new Error("player not found");
    const teams = ((tm ?? []) as { teams: { name: string } | { name: string }[] | null }[])
      .map((m) => (Array.isArray(m.teams) ? m.teams[0]?.name : m.teams?.name))
      .filter((n): n is string => !!n);
    return {
      playerId: p.id as string,
      name: p.full_name as string,
      position: (p.position as string | null) ?? null,
      secondaryPosition: (p.secondary_pos as string | null) ?? null,
      preferredFoot: (p.preferred_foot as string | null) ?? null,
      teams,
      href: playerHref(ctx, playerId),
    };
  },
  links: (o) => ("href" in o && o.href ? [{ label: o.name, href: o.href }] : []),
};
