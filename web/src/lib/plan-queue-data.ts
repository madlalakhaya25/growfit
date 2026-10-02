import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingAiArtefactsTable, mapArtefactRow } from "@/lib/ai-artefacts";
import type { DevelopmentPlanStructured } from "@/lib/development-plan-schema";
import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";

export interface QueuePlayer {
  id: string;
  name: string;
  /** The coach's current plan for this player: a draft being reviewed, or the approved one. */
  plan: { artefactId: string; status: "draft" | "approved"; data: DevelopmentPlanStructured; createdAt: string } | null;
  /** Focus areas of the plan the family can read now, to show what a new draft changes. */
  sharedAreas: string[] | null;
}

export interface PlanQueueSnapshot {
  /** False until migration 045: the page then explains, rather than failing. */
  available: boolean;
  players: QueuePlayer[];
}

type Person = { id: string; full_name: string };

/** Every active player on a team with the latest coach plan and the shared plan. Two reads for the whole squad. */
export async function loadPlanQueue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string
): Promise<PlanQueueSnapshot> {
  const membersRes = await supabase
    .from("team_members")
    .select("players ( id, full_name )")
    .eq("team_id", teamId)
    .eq("active", true);
  const roster = ((membersRes.data ?? []) as unknown as { players: Person | Person[] | null }[])
    .flatMap((m) => [m.players ?? []].flat())
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id));
  if (!roster.length) return { available: true, players: [] };

  const { data, error } = await supabase
    .from("ai_artefacts")
    .select("*")
    .in("kind", ["development_plan", "development_plan_shared"])
    .eq("subject_type", "player")
    .in("subject_id", roster.map((p) => p.id))
    .is("superseded_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    return { available: !isMissingAiArtefactsTable(error), players: [] };
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => mapArtefactRow<unknown>(r));

  return {
    available: true,
    players: roster.map((p) => {
      const mine = rows.filter((r) => r.subjectId === p.id);
      const latest = mine.find((r) => r.kind === "development_plan");
      const shared = mine.find((r) => r.kind === "development_plan_shared");
      return {
        id: p.id,
        name: p.full_name,
        plan: latest
          ? {
              artefactId: latest.id,
              status: latest.status,
              data: latest.data as DevelopmentPlanStructured,
              createdAt: latest.createdAt,
            }
          : null,
        sharedAreas: shared ? (shared.data as PlayerSafeDevelopmentPlan).focusAreas.map((f) => f.area) : null,
      };
    }),
  };
}
