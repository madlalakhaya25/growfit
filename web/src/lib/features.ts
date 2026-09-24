import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Feature names an academy can hide. Kept as a plain string union rather
 * than a DB enum: adding one is a one-line change here, not a migration.
 * Never put anything safeguarding- or compliance-related in this list --
 * those stay always on regardless of what an academy toggles.
 */
export type FeatureKey = "tactics" | "film" | "assistant";

const ALL_ON: Record<FeatureKey, boolean> = {
  tactics: true,
  film: true,
  assistant: true,
};

/**
 * Reads `academies.features` (migration 042). Same fallback shape as
 * `isMissingAttributeColumn` in attributes.ts: if the column hasn't been
 * migrated onto the live project yet, every feature reads as on rather
 * than the nav silently losing sections. An absent key in a real `features`
 * value also means "on" -- a toggle only ever turns something *off*.
 */
export async function getAcademyFeatures(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  academyId: string | null | undefined
): Promise<Record<FeatureKey, boolean>> {
  if (!academyId) return ALL_ON;

  const { data, error } = await supabase
    .from("academies")
    .select("features")
    .eq("id", academyId)
    .maybeSingle();

  if (error?.code === "42703" || error?.code === "PGRST204" || !data) {
    return ALL_ON;
  }

  const stored = (data.features ?? {}) as Partial<Record<FeatureKey, boolean>>;
  return { ...ALL_ON, ...stored };
}
