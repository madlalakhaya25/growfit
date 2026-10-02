import type { SupabaseClient } from "@supabase/supabase-js";
import { tallySquadFocus, type PlanFocus, type SquadFocus } from "@/lib/squad-focus";
import { readSharedPlan } from "@/lib/shared-development-plan";

const EMPTY: SquadFocus = { rows: [], planned: 0, squadSize: 0 };

/**
 * What a team's approved development plans are working on. Only plans a coach
 * has approved and that are still current count. Absent table or no plans
 * gives an empty answer, not an error.
 */
export async function loadSquadFocus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string
): Promise<SquadFocus> {
  const membersRes = await supabase.from("team_members").select("player_id").eq("team_id", teamId).eq("active", true);
  const ids = ((membersRes.data ?? []) as { player_id: string }[]).map((m) => m.player_id);
  if (ids.length === 0) return EMPTY;

  const { data, error } = await supabase
    .from("ai_artefacts")
    .select("subject_id, data, created_at")
    .eq("kind", "development_plan_shared")
    .eq("subject_type", "player")
    .eq("status", "approved")
    .is("superseded_at", null)
    .in("subject_id", ids)
    .order("created_at", { ascending: false });
  if (error) return { ...EMPTY, squadSize: ids.length };

  // Newest first, so the first row seen for a player is their current plan.
  const latest = new Map<string, PlanFocus>();
  for (const row of (data ?? []) as { subject_id: string; data: unknown }[]) {
    if (latest.has(row.subject_id)) continue;
    const plan = readSharedPlan(row.data);
    if (plan) latest.set(row.subject_id, { playerId: row.subject_id, focusAreas: plan.focusAreas });
  }
  return tallySquadFocus([...latest.values()], ids.length);
}
