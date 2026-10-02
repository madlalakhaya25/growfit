import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevelopmentAction, DevelopmentFocusArea } from "@/lib/development-plan-schema";
import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";
import { getLatestAiArtefact } from "@/lib/ai-artefacts";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";

export interface SharedDevelopmentPlan {
  plan: PlayerSafeDevelopmentPlan;
  approvedByName: string | null;
  approvedAt: string | null;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Rebuilds a PlayerSafeDevelopmentPlan field by field from a stored row, so
 * anything extra on the row (a `coachNote` that should never have been there)
 * is dropped here as well as at write time. Returns null for a row that does
 * not look like a plan, so a malformed row shows nothing rather than a broken
 * page.
 */
export function readSharedPlan(data: unknown): PlayerSafeDevelopmentPlan | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.focusAreas) || !Array.isArray(d.actions)) return null;

  const focusAreas: DevelopmentFocusArea[] = [];
  for (const item of d.focusAreas) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const category = MILESTONE_CATEGORIES.find((c) => c === f.category);
    if (!category || !text(f.area)) continue;
    focusAreas.push({ category, area: text(f.area), why: text(f.why) });
  }

  const actions: DevelopmentAction[] = [];
  for (const item of d.actions) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (!text(a.what)) continue;
    const times = Math.round(Number(a.timesPerWeek));
    actions.push({
      what: text(a.what),
      how: text(a.how),
      timesPerWeek: Number.isFinite(times) && times > 0 ? times : 1,
      measure: text(a.measure),
      milestoneTemplateId: typeof a.milestoneTemplateId === "string" ? a.milestoneTemplateId : null,
    });
  }

  if (focusAreas.length === 0 && actions.length === 0) return null;
  return { focusAreas, actions, reviewDate: text(d.reviewDate), playerNote: text(d.playerNote) };
}

/**
 * The plan a coach has approved for a player, as the player or their parent
 * may see it. Reads the 'development_plan_shared' row only; migration 045's RLS
 * already limits a player or parent to that row once it is approved, and the
 * `status` filter here keeps the same rule in the code. Null when there is
 * nothing shared yet, including before migration 045.
 */
export async function loadSharedDevelopmentPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string
): Promise<SharedDevelopmentPlan | null> {
  const { artefact } = await getLatestAiArtefact<unknown>(supabase, {
    kind: "development_plan_shared",
    subjectType: "player",
    subjectId: playerId,
    status: "approved",
  });
  if (!artefact || !artefact.approvedAt) return null;
  const plan = readSharedPlan(artefact.data);
  if (!plan) return null;
  return { plan, approvedByName: artefact.approvedByName, approvedAt: artefact.approvedAt };
}
