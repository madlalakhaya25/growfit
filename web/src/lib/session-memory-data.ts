import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsAttended, countsTowardTotal, isAttendanceStatus } from "@/lib/attendance";
import { MEMORY_SESSIONS, type PastSession } from "@/lib/session-memory";

/**
 * The team's most recent sessions before `before`, with the drills actually
 * attached to each and its register. "What was coached" is what is on the
 * session, which is what the coach applied or built -- not what an earlier
 * generation merely suggested.
 *
 * RPE is not read here: it arrives with docs/BACKLOG.md 5.4's migration 047,
 * which has not shipped, and nothing may depend on a column that isn't there.
 *
 * Never throws: memory makes a plan better, and its absence must not stop one.
 */
export async function loadRecentSessions(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  before: Date,
  excludeSessionId?: string
): Promise<PastSession[]> {
  try {
    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("id, title, session_type, session_date, notes")
      .eq("team_id", teamId)
      .lt("session_date", before.toISOString())
      .order("session_date", { ascending: false })
      .limit(MEMORY_SESSIONS + 1);

    const rows = ((sessions ?? []) as {
      id: string; title: string; session_type: string; session_date: string; notes: string | null;
    }[])
      .filter((s) => s.id !== excludeSessionId)
      .slice(0, MEMORY_SESSIONS);
    if (rows.length === 0) return [];
    const ids = rows.map((s) => s.id);

    const [{ data: drills }, { data: marks }] = await Promise.all([
      supabase.from("training_drills").select("session_id, title, description, sort_order").in("session_id", ids).order("sort_order"),
      supabase.from("training_attendance").select("session_id, status").in("session_id", ids),
    ]);

    return rows.map((s) => {
      const statuses = ((marks ?? []) as { session_id: string; status: string }[])
        .filter((m) => m.session_id === s.id && isAttendanceStatus(m.status))
        .map((m) => m.status as Parameters<typeof countsTowardTotal>[0]);
      return {
        title: s.title,
        sessionType: s.session_type,
        date: s.session_date,
        notes: s.notes,
        drills: ((drills ?? []) as { session_id: string; title: string; description: string | null }[])
          .filter((d) => d.session_id === s.id)
          .map((d) => ({ title: d.title, description: d.description })),
        attended: statuses.filter((st) => countsTowardTotal(st) && countsAsAttended(st)).length,
        assessed: statuses.filter(countsTowardTotal).length,
      };
    });
  } catch {
    return [];
  }
}
