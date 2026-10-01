import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsAttended, isAttendanceStatus } from "@/lib/attendance";
import { typicalTurnout } from "@/lib/session-constraints";

/**
 * How many players usually turn up for a team, from its most recent registers,
 * to prefill the session generator's player count. Uses the same notion of
 * "attended" as the attendance policy (present or late; an excused absence is
 * not a turnout), counted per session. null when no register has been marked,
 * so the form falls back to its own default instead of a misleading 0.
 *
 * Never throws: a prefill is a convenience, never worth failing a page over.
 */
export async function recentTurnout(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  now: Date = new Date()
): Promise<number | null> {
  try {
    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("team_id", teamId)
      .lte("session_date", now.toISOString())
      .order("session_date", { ascending: false })
      .limit(6);
    const ids = ((sessions ?? []) as { id: string }[]).map((s) => s.id);
    if (ids.length === 0) return null;

    const { data: marks } = await supabase
      .from("training_attendance")
      .select("session_id, status")
      .in("session_id", ids);

    const attended = new Map<string, number>(ids.map((id) => [id, 0]));
    for (const m of (marks ?? []) as { session_id: string; status: string }[]) {
      if (isAttendanceStatus(m.status) && countsAsAttended(m.status)) {
        attended.set(m.session_id, (attended.get(m.session_id) ?? 0) + 1);
      }
    }
    // `ids` is newest first; sessions nobody was marked at drop out in typicalTurnout.
    return typicalTurnout(ids.map((id) => attended.get(id) ?? 0));
  } catch {
    return null;
  }
}
