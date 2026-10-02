import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATTENDANCE_WINDOW_DAYS,
  isAttendanceStatus,
  summariseAttendance,
  type AttendanceStatus,
} from "@/lib/attendance";

export const WELFARE_LOAD_ERROR = "Welfare alerts couldn't be loaded right now.";

export interface WelfareAlert {
  playerId: string;
  fullName: string;
  teamName: string;
  attendancePct: number;
  /** How many sessions that percentage is out of — a 50% from two sessions
   *  is a very different conversation from a 50% from twenty. */
  sessionsAssessed: number;
  lastCheckin: { note: string | null; createdAt: string; loggedBy: string | null } | null;
}

/**
 * Players on the given teams who are below the 75% training attendance
 * threshold over the recent window — the surface the roadmap flagged as
 * missing entirely. The CALLER decides which teams: the welfare page passes the
 * teams the user coaches, the agent passes the teams it scoped for them (an
 * admin's are every team in the academy). Not a Server Action, so a client can
 * never choose the teams itself. Recomputed live each call, so a
 * player drops off the list the moment their attendance recovers; a logged
 * check-in doesn't hide them, since the underlying concern isn't resolved by
 * a coach acknowledging it.
 */
export async function loadWelfareAlerts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamIds: string[]
): Promise<{ alerts: WelfareAlert[] } | { error: string }> {
  if (!teamIds.length) return { alerts: [] };

  // Every query below fails loudly. On a safeguarding screen a failed load
  // that reads as "no players below 75%" is the worst possible answer.
  const { data: teams, error: teamsError } = await supabase.from("teams").select("id, name").in("id", teamIds);
  if (teamsError) return { error: WELFARE_LOAD_ERROR };
  const teamNameById = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("team_id, players ( id, full_name )")
    .in("team_id", teamIds)
    .eq("active", true);
  if (membersError) return { error: WELFARE_LOAD_ERROR };

  type MemberPlayer = { id: string; full_name: string };
  type MemberRow = { team_id: string; players: MemberPlayer | MemberPlayer[] | null };
  const rows = (members ?? []) as MemberRow[];
  const players = rows.flatMap((m) => {
    const p = Array.isArray(m.players) ? m.players[0] : m.players;
    return p ? [{ ...p, teamId: m.team_id }] : [];
  });
  if (!players.length) return { alerts: [] };

  const playerIds = players.map((p) => p.id);

  const since = new Date(Date.now() - ATTENDANCE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: sessions, error: sessionsError } = await supabase
    .from("training_sessions")
    .select("id")
    .in("team_id", teamIds)
    .gte("session_date", since);
  if (sessionsError) return { error: WELFARE_LOAD_ERROR };
  const sessionCount = (sessions ?? []).length;
  if (sessionCount === 0) return { alerts: [] };

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  const { data: attendance, error: attendanceError } = await supabase
    .from("training_attendance")
    .select("player_id, status")
    .in("session_id", sessionIds)
    .in("player_id", playerIds);
  if (attendanceError) return { error: WELFARE_LOAD_ERROR };

  // Collect each player's marks and let summariseAttendance apply the policy
  // (late counts as attending, excused is left out of the total). This used
  // to count `status === "present"` against a denominator of *every session
  // in the window* — so an unmarked register dragged everyone down, and a
  // coach who had never marked attendance saw their whole squad flagged.
  const marksByPlayer = new Map<string, AttendanceStatus[]>();
  for (const row of (attendance ?? []) as { player_id: string; status: string }[]) {
    if (!isAttendanceStatus(row.status)) continue;
    const list = marksByPlayer.get(row.player_id) ?? [];
    list.push(row.status);
    marksByPlayer.set(row.player_id, list);
  }

  // `noted_by` is who actually logged this — never surfaced before, on a
  // table two or more coaches on the same team can both write to
  // (docs/BACKLOG.md 2.9). Without it, one coach sees "last checked in 12
  // Sept" with no way to tell whether that was them or a colleague.
  const { data: checkins, error: checkinsError } = await supabase
    .from("welfare_checkins")
    .select("player_id, note, created_at, noted_by, profiles ( full_name )")
    .in("player_id", playerIds)
    .order("created_at", { ascending: false });
  // A missing check-in would read as "never checked in" — also a wrong answer.
  if (checkinsError) return { error: WELFARE_LOAD_ERROR };

  type CheckinRow = {
    player_id: string; note: string | null; created_at: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
  };
  const lastCheckinByPlayer = new Map<string, { note: string | null; createdAt: string; loggedBy: string | null }>();
  for (const c of (checkins ?? []) as CheckinRow[]) {
    if (lastCheckinByPlayer.has(c.player_id)) continue;
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    lastCheckinByPlayer.set(c.player_id, {
      note: c.note,
      createdAt: c.created_at,
      loggedBy: profile?.full_name ?? null,
    });
  }

  const alerts: WelfareAlert[] = players
    .map((p) => ({ player: p, summary: summariseAttendance(marksByPlayer.get(p.id) ?? []) }))
    // `belowThreshold` is false when nothing has been marked, so a player
    // with no register entries no longer appears here at all. That is the
    // honest answer — there is nothing yet to have a welfare conversation
    // about — and it is what stops this list from being the whole squad.
    .filter(({ summary }) => summary.belowThreshold)
    .map(({ player, summary }) => ({
      playerId: player.id,
      fullName: player.full_name,
      teamName: teamNameById.get(player.teamId) ?? "—",
      attendancePct: summary.pct ?? 0,
      sessionsAssessed: summary.assessed,
      lastCheckin: lastCheckinByPlayer.get(player.id) ?? null,
    }))
    .sort((a, b) => a.attendancePct - b.attendancePct);

  return { alerts };
}
