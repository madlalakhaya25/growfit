"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { attendancePct, isBelowWelfareThreshold, ATTENDANCE_WINDOW_DAYS } from "@/lib/attendance";

export interface WelfareAlert {
  playerId: string;
  fullName: string;
  teamName: string;
  attendancePct: number;
  lastCheckin: { note: string | null; createdAt: string } | null;
}

/**
 * Players across every team this coach coaches who are below the 75%
 * training attendance threshold over the recent window — the surface the
 * roadmap flagged as missing entirely. Recomputed live each call, so a
 * player drops off the list the moment their attendance recovers; a logged
 * check-in doesn't hide them, since the underlying concern isn't resolved by
 * a coach acknowledging it.
 */
export async function getWelfareAlerts(): Promise<{ alerts: WelfareAlert[] } | { error: string }> {
  const { supabase, user } = await requireUser();

  const teamIds = await getCoachedTeamIds(supabase, user.id);
  if (!teamIds.length) return { alerts: [] };

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
  const teamNameById = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

  const { data: members } = await supabase
    .from("team_members")
    .select("team_id, players ( id, full_name )")
    .in("team_id", teamIds)
    .eq("active", true);

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
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id")
    .in("team_id", teamIds)
    .gte("session_date", since);
  const sessionCount = (sessions ?? []).length;
  if (sessionCount === 0) return { alerts: [] };

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  const { data: attendance } = await supabase
    .from("training_attendance")
    .select("player_id, status")
    .in("session_id", sessionIds)
    .in("player_id", playerIds);

  const presentByPlayer = new Map<string, number>();
  for (const row of (attendance ?? []) as { player_id: string; status: string }[]) {
    if (row.status === "present") {
      presentByPlayer.set(row.player_id, (presentByPlayer.get(row.player_id) ?? 0) + 1);
    }
  }

  const { data: checkins } = await supabase
    .from("welfare_checkins")
    .select("player_id, note, created_at")
    .in("player_id", playerIds)
    .order("created_at", { ascending: false });

  const lastCheckinByPlayer = new Map<string, { note: string | null; createdAt: string }>();
  for (const c of (checkins ?? []) as { player_id: string; note: string | null; created_at: string }[]) {
    if (!lastCheckinByPlayer.has(c.player_id)) {
      lastCheckinByPlayer.set(c.player_id, { note: c.note, createdAt: c.created_at });
    }
  }

  const alerts: WelfareAlert[] = players
    .filter((p) => isBelowWelfareThreshold(presentByPlayer.get(p.id) ?? 0, sessionCount))
    .map((p) => ({
      playerId: p.id,
      fullName: p.full_name,
      teamName: teamNameById.get(p.teamId) ?? "—",
      attendancePct: attendancePct(presentByPlayer.get(p.id) ?? 0, sessionCount) ?? 0,
      lastCheckin: lastCheckinByPlayer.get(p.id) ?? null,
    }))
    .sort((a, b) => a.attendancePct - b.attendancePct);

  return { alerts };
}

export async function logWelfareCheckin(
  playerId: string,
  attendancePctAtCheckin: number,
  note: string
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("welfare_checkins").insert({
    player_id: playerId,
    noted_by: user.id,
    attendance_pct: attendancePctAtCheckin,
    note: note.trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach", "page");
  return { success: true };
}
