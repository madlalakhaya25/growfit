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

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

function readFocusArea(item: unknown): DevelopmentFocusArea | null {
  if (!isRecord(item)) return null;
  const category = MILESTONE_CATEGORIES.find((c) => c === item.category);
  if (!category || !text(item.area)) return null;
  return { category, area: text(item.area), why: text(item.why) };
}

function readAction(item: unknown): DevelopmentAction | null {
  if (!isRecord(item) || !text(item.what)) return null;
  const times = Math.round(Number(item.timesPerWeek));
  return {
    what: text(item.what),
    how: text(item.how),
    timesPerWeek: Number.isFinite(times) && times > 0 ? times : 1,
    measure: text(item.measure),
    milestoneTemplateId: typeof item.milestoneTemplateId === "string" ? item.milestoneTemplateId : null,
  };
}

/**
 * Rebuilds a PlayerSafeDevelopmentPlan field by field from a stored row, so
 * anything extra on the row (a `coachNote` that should never have been there)
 * is dropped here as well as at write time. Returns null for a row that does
 * not look like a plan, so a malformed row shows nothing rather than a broken
 * page.
 */
export function readSharedPlan(data: unknown): PlayerSafeDevelopmentPlan | null {
  if (!isRecord(data) || !Array.isArray(data.focusAreas) || !Array.isArray(data.actions)) return null;
  const focusAreas = data.focusAreas.map(readFocusArea).filter((f): f is DevelopmentFocusArea => f !== null);
  const actions = data.actions.map(readAction).filter((a): a is DevelopmentAction => a !== null);
  if (focusAreas.length === 0 && actions.length === 0) return null;
  return { focusAreas, actions, reviewDate: text(data.reviewDate), playerNote: text(data.playerNote) };
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
  if (!artefact?.approvedAt) return null;
  const plan = readSharedPlan(artefact.data);
  if (!plan) return null;
  return { plan, approvedByName: artefact.approvedByName, approvedAt: artefact.approvedAt };
}
