import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCurves, CURVE_MONTHS, type Curves } from "@/lib/curves";

/**
 * One child's curves for the coach, from what is already recorded. Read-only
 * and never throws: a failed read leaves that line empty, so the card shows
 * only what it can stand behind.
 */
export async function loadCurves(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string,
  now: Date = new Date(),
): Promise<Curves> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (CURVE_MONTHS - 1), 1)).toISOString();

  const [{ data: ratings }, { data: milestones }, { data: att }] = await Promise.all([
    supabase.from("player_ratings").select("rating, created_at").eq("player_id", playerId).gte("created_at", start),
    supabase.from("player_milestone_completions").select("completed_at").eq("player_id", playerId).gte("completed_at", start),
    supabase.from("training_attendance").select("status, training_sessions ( session_date )").eq("player_id", playerId),
  ]);

  type AttRow = { status: string; training_sessions: { session_date: string } | { session_date: string }[] | null };
  const attendance = ((att ?? []) as unknown as AttRow[]).flatMap((r) => {
    const s = Array.isArray(r.training_sessions) ? r.training_sessions[0] : r.training_sessions;
    return s?.session_date && s.session_date >= start ? [{ date: s.session_date, status: r.status }] : [];
  });

  return buildCurves({
    ratings: ((ratings ?? []) as { rating: number; created_at: string }[]).map((r) => ({ date: r.created_at, rating: r.rating })),
    attendance,
    milestones: ((milestones ?? []) as { completed_at: string | null }[]).flatMap((m) => (m.completed_at ? [m.completed_at] : [])),
  }, now);
}
