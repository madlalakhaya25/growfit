import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingHomeworkTable } from "@/lib/homework";

export interface PlayerHomeworkRow {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
  score: number | null;
  total: number | null;
  completedAt: string | null;
}

/**
 * A child's tactics homework (migration 063): what their teams were sent and
 * whether they've done it. Read by the player themself (development page, as
 * evidence for the Tactical category) and by a linked parent (read-only). RLS
 * decides who may see it; this only shapes the rows. Before 063 runs it
 * returns `available: false` and the caller shows nothing.
 */
export async function loadPlayerHomework(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string,
): Promise<{ available: boolean; rows: PlayerHomeworkRow[] }> {
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", playerId)
    .eq("active", true);
  const teamIds = ((memberships ?? []) as { team_id: string }[]).map((m) => m.team_id);
  if (teamIds.length === 0) return { available: true, rows: [] };

  const { data, error } = await supabase
    .from("homework_assignments")
    .select("id, title, due_date")
    .in("team_id", teamIds)
    .order("due_date", { ascending: false })
    .limit(20);
  if (isMissingHomeworkTable(error)) return { available: false, rows: [] };
  if (error) return { available: true, rows: [] };
  const assignments = (data ?? []) as { id: string; title: string; due_date: string }[];
  if (assignments.length === 0) return { available: true, rows: [] };

  const { data: responses } = await supabase
    .from("homework_responses")
    .select("assignment_id, score, total, completed_at")
    .eq("player_id", playerId)
    .in("assignment_id", assignments.map((a) => a.id));
  type R = { assignment_id: string; score: number; total: number; completed_at: string };
  const byId = new Map(((responses ?? []) as R[]).map((r) => [r.assignment_id, r]));

  return {
    available: true,
    rows: assignments.map((a) => {
      const r = byId.get(a.id);
      return {
        id: a.id, title: a.title, dueDate: a.due_date,
        done: Boolean(r), score: r?.score ?? null, total: r?.total ?? null, completedAt: r?.completed_at ?? null,
      };
    }),
  };
}
