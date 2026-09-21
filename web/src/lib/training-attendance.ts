import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attendanceWindowStart, isAttendanceStatus, summariseAttendance,
  type AttendanceStatus, type AttendanceSummary,
} from "@/lib/attendance";

/**
 * One training-attendance summary per player, over the rolling window.
 *
 * The squad-context AI brief, the welfare page and the squad list each
 * assemble this themselves (same window, same query shape, same vocabulary),
 * which is how they drifted before (`lib/attendance.ts`'s own history).
 * New server-rendered surfaces that need the same numbers — starting with the
 * match squad-selection screen, which previously had no idea who trains —
 * should reach for this rather than writing a fourth copy of the query.
 */
export async function getTrainingAttendanceSummaries(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  playerIds: string[]
): Promise<Map<string, AttendanceSummary>> {
  const summaries = new Map<string, AttendanceSummary>();
  if (playerIds.length === 0) return summaries;

  const since = attendanceWindowStart();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("team_id", teamId)
    .gte("session_date", since);
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length === 0) return summaries;

  const { data: att } = await supabase
    .from("training_attendance")
    .select("player_id, status")
    .in("session_id", sessionIds)
    .in("player_id", playerIds);

  const marksByPlayer = new Map<string, AttendanceStatus[]>();
  for (const row of (att ?? []) as { player_id: string; status: string }[]) {
    if (!isAttendanceStatus(row.status)) continue;
    const list = marksByPlayer.get(row.player_id) ?? [];
    list.push(row.status);
    marksByPlayer.set(row.player_id, list);
  }

  for (const id of playerIds) {
    summaries.set(id, summariseAttendance(marksByPlayer.get(id) ?? []));
  }
  return summaries;
}
