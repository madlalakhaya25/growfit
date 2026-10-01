import {
  ATTENDANCE_WINDOW_DAYS,
  isAttendanceStatus,
  summariseAttendance,
  type AttendanceStatus,
} from "@/lib/attendance";
import {
  asRecord, authorisePlayer, boundedInt, DEFAULT_MAX_ROWS, isUuid, NOT_YOUR_PLAYER, playerHref, scopedTeamIds,
} from "./shared";
import type { AgentTool } from "./types";

interface Input { playerId?: string; teamId?: string; days: number }
interface Row { playerId: string; name: string; attended: number; assessed: number; pct: number | null; belowThreshold: boolean; href?: string }
type Output = { error: string } | { windowDays: number; threshold: "75%"; sessions: number; players: Row[]; truncated: boolean };

/**
 * Attendance over a window, per the academy's one policy (`summariseAttendance`:
 * late counts as attending, excused is left out). Either one player, or every
 * player on the caller's teams, lowest first.
 */
export const getAttendance: AgentTool<Input, Output> = {
  name: "getAttendance",
  description:
    "Returns training attendance percentages over a recent window for one player, one team, or all the caller's teams, lowest first.",
  parameters: {
    type: "object",
    properties: {
      playerId: { type: "string", description: "A single player's id." },
      teamId: { type: "string", description: "A single team's id." },
      days: { type: "integer", description: "Window in days, 7 to 180. Defaults to 90." },
    },
  },
  maxRows: DEFAULT_MAX_ROWS,
  parseInput(raw) {
    const r = asRecord(raw ?? {});
    if (!r) return null;
    if (r.playerId != null && r.teamId != null) return null;
    if (r.playerId != null && !isUuid(r.playerId)) return null;
    if (r.teamId != null && !isUuid(r.teamId)) return null;
    const days = boundedInt(r.days, { min: 7, max: 180, fallback: ATTENDANCE_WINDOW_DAYS });
    if (days === undefined) return null;
    return {
      playerId: (r.playerId as string | undefined) ?? undefined,
      teamId: (r.teamId as string | undefined) ?? undefined,
      days,
    };
  },
  async run(ctx, input) {
    let teamIds: string[];
    let players: { id: string; name: string }[];

    if (input.playerId) {
      const auth = await authorisePlayer(ctx, input.playerId);
      if (!auth) return NOT_YOUR_PLAYER;
      players = [{ id: input.playerId, name: auth.fullName }];
      // Sessions of the caller's teams only — a coach never sees marks from
      // a team they don't coach, even for a player they do.
      teamIds = ctx.teamIds;
    } else {
      teamIds = scopedTeamIds(ctx, input.teamId);
      if (!teamIds.length) return { windowDays: input.days, threshold: "75%", sessions: 0, players: [], truncated: false };
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

    const since = new Date(Date.now() - input.days * 24 * 3600 * 1000).toISOString();
    const { data: sessions, error: sErr } = await ctx.supabase
      .from("training_sessions")
      .select("id")
      .in("team_id", teamIds)
      .gte("session_date", since);
    if (sErr) throw sErr;
    const sessionIds = ((sessions ?? []) as { id: string }[]).map((s) => s.id);

    const marks = new Map<string, AttendanceStatus[]>();
    if (sessionIds.length && players.length) {
      const { data: att, error: aErr } = await ctx.supabase
        .from("training_attendance")
        .select("player_id, status")
        .in("session_id", sessionIds)
        .in("player_id", players.map((p) => p.id));
      if (aErr) throw aErr;
      for (const row of (att ?? []) as { player_id: string; status: string }[]) {
        if (!isAttendanceStatus(row.status)) continue;
        const list = marks.get(row.player_id) ?? [];
        list.push(row.status);
        marks.set(row.player_id, list);
      }
    }

    const rows: Row[] = players
      .map((p) => {
        const s = summariseAttendance(marks.get(p.id) ?? []);
        return { playerId: p.id, name: p.name, attended: s.attended, assessed: s.assessed, pct: s.pct, belowThreshold: s.belowThreshold, href: playerHref(ctx, p.id) };
      })
      // "Not assessed" (null) sorts last: nothing marked is not the same as 0%.
      .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));

    return {
      windowDays: input.days,
      threshold: "75%",
      sessions: sessionIds.length,
      players: rows.slice(0, getAttendance.maxRows),
      truncated: rows.length > getAttendance.maxRows,
    };
  },
  links: (o) =>
    "players" in o ? o.players.filter((p) => p.href).map((p) => ({ label: p.name, href: p.href!, match: [p.name] })) : [],
};
