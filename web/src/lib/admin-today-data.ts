import type { SupabaseClient } from "@supabase/supabase-js";
import { summariseCompliance, type ComplianceSummary } from "@/lib/admin-today";
import { loadWelfareAlerts } from "@/lib/welfare-alerts";

export interface AdminTodayRows {
  members: { player_id: string; team_id: string }[];
  docs: { player_id: string; document_type: string; status: string }[];
}

/**
 * Registration health and the below-75% count for the admin's Today page. The
 * caller has already checked the rows loaded; a failed welfare load gives a null
 * count (unknown), never a zero.
 */
export async function loadAdminToday(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  academyId: string,
  rows: AdminTodayRows,
): Promise<{ compliance: ComplianceSummary; welfareCount: number | null }> {
  const docsByPlayer = new Map<string, Map<string, string>>();
  for (const r of rows.docs) {
    const m = docsByPlayer.get(r.player_id) ?? new Map<string, string>();
    m.set(r.document_type, r.status);
    docsByPlayer.set(r.player_id, m);
  }
  const teamOf = new Map<string, string>();
  for (const m of rows.members) {
    if (!teamOf.has(m.player_id)) teamOf.set(m.player_id, m.team_id);
  }
  const { data } = await supabase
    .from("teams")
    .select("id, name, age_group")
    .eq("academy_id", academyId)
    .eq("active", true);
  const teams = (data ?? []) as { id: string; name: string; age_group: string | null }[];
  const compliance = summariseCompliance(
    [...teamOf.keys()].map((id) => ({ id, teamId: teamOf.get(id) ?? null, docStatus: docsByPlayer.get(id) ?? new Map() })),
    teams.map((t) => ({ id: t.id, name: t.name, ageGroup: t.age_group })),
  );
  const welfare = await loadWelfareAlerts(supabase, teams.map((t) => t.id));
  return { compliance, welfareCount: "alerts" in welfare ? welfare.alerts.length : null };
}
