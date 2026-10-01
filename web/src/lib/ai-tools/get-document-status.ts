import { currentSeason } from "@/lib/development-categories";
import { DOCUMENTS, isDocComplete } from "@/lib/document-definitions";
import {
  asRecord, authorisePlayer, DEFAULT_MAX_ROWS, isUuid, NOT_YOUR_PLAYER, playerHref, scopedTeamIds,
} from "./shared";
import type { AgentTool } from "./types";

interface Input { playerId?: string; teamId?: string }
interface Row { playerId: string; name: string; outstanding: string[]; href?: string }
type Output =
  | { error: string }
  | { season: string; requiredCount: number; players: Row[]; truncated: boolean };

/**
 * Which registration documents are still outstanding this season. Reads only
 * `document_type` and `status` — never signer names, file names or upload
 * URLs, which are the sensitive parts of the record.
 */
export const getDocumentStatus: AgentTool<Input, Output> = {
  name: "getDocumentStatus",
  description:
    "Returns, per player, which registration documents are still outstanding this season, most outstanding first.",
  parameters: {
    type: "object",
    properties: {
      playerId: { type: "string", description: "A single player's id." },
      teamId: { type: "string", description: "A single team's id." },
    },
  },
  maxRows: DEFAULT_MAX_ROWS,
  parseInput(raw) {
    const r = asRecord(raw ?? {});
    if (!r) return null;
    if (r.playerId != null && r.teamId != null) return null;
    if (r.playerId != null && !isUuid(r.playerId)) return null;
    if (r.teamId != null && !isUuid(r.teamId)) return null;
    return {
      playerId: (r.playerId as string | undefined) ?? undefined,
      teamId: (r.teamId as string | undefined) ?? undefined,
    };
  },
  async run(ctx, input) {
    const season = currentSeason();
    let players: { id: string; name: string }[];

    if (input.playerId) {
      const auth = await authorisePlayer(ctx, input.playerId);
      if (!auth) return NOT_YOUR_PLAYER;
      players = [{ id: input.playerId, name: auth.fullName }];
    } else {
      const teamIds = scopedTeamIds(ctx, input.teamId);
      if (!teamIds.length) return { season, requiredCount: DOCUMENTS.length, players: [], truncated: false };
      const { data, error } = await ctx.supabase
        .from("team_members")
        .select("players ( id, full_name )")
        .in("team_id", teamIds)
        .eq("active", true);
      if (error) throw error;
      const seen = new Set<string>();
      players = [];
      for (const m of (data ?? []) as { players: { id: string; full_name: string } | { id: string; full_name: string }[] | null }[]) {
        const p = Array.isArray(m.players) ? m.players[0] : m.players;
        if (p && !seen.has(p.id)) { seen.add(p.id); players.push({ id: p.id, name: p.full_name }); }
      }
    }

    const statusByPlayer = new Map<string, Map<string, string>>();
    if (players.length) {
      const { data, error } = await ctx.supabase
        .from("player_documents")
        .select("player_id, document_type, status")
        .in("player_id", players.map((p) => p.id))
        .eq("season", season);
      if (error) throw error;
      for (const d of (data ?? []) as { player_id: string; document_type: string; status: string }[]) {
        const m = statusByPlayer.get(d.player_id) ?? new Map<string, string>();
        m.set(d.document_type, d.status);
        statusByPlayer.set(d.player_id, m);
      }
    }

    const rows: Row[] = players
      .map((p) => {
        const have = statusByPlayer.get(p.id);
        const outstanding = DOCUMENTS.filter((def) => !isDocComplete(def, have?.get(def.type))).map((d) => d.label);
        return { playerId: p.id, name: p.name, outstanding, href: playerHref(ctx, p.id) };
      })
      .filter((r) => r.outstanding.length > 0 || input.playerId)
      .sort((a, b) => b.outstanding.length - a.outstanding.length);

    return {
      season,
      requiredCount: DOCUMENTS.length,
      players: rows.slice(0, getDocumentStatus.maxRows),
      truncated: rows.length > getDocumentStatus.maxRows,
    };
  },
  links: (o) =>
    "players" in o ? o.players.filter((p) => p.href).map((p) => ({ label: p.name, href: p.href! })) : [],
};
