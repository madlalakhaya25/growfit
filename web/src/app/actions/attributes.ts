"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  CORE_ATTR_KEYS,
  isMissingAttributeColumn,
  MISSING_ATTR_COLUMNS_MESSAGE,
  type AttrKey,
} from "@/lib/attributes";

const optionalAttr = z.number().int().min(1).max(99).optional();

const attributesSchema = z.object({
  notes:            z.string().max(300).optional(),
  pace:             optionalAttr,
  shooting:         optionalAttr,
  passing:          optionalAttr,
  dribbling:        optionalAttr,
  defending:        optionalAttr,
  physical:         optionalAttr,
  ball_control:     optionalAttr,
  crossing:         optionalAttr,
  heading:          optionalAttr,
  tackling:         optionalAttr,
  finishing:        optionalAttr,
  first_touch:      optionalAttr,
  stamina:          optionalAttr,
  agility:          optionalAttr,
  jumping:          optionalAttr,
  strength:         optionalAttr,
  positioning:      optionalAttr,
  decision_making:  optionalAttr,
  composure:        optionalAttr,
  work_rate:        optionalAttr,
  leadership:       optionalAttr,
  shot_stopping:    optionalAttr,
  reflexes:         optionalAttr,
  distribution:     optionalAttr,
  handling:         optionalAttr,
});

export async function upsertPlayerAttributes(
  playerId: string,
  payload: Partial<Record<AttrKey, number>> & { notes?: string }
): Promise<{ error?: string; success?: boolean; warning?: string }> {
  const { supabase, user } = await requireUser();

  const parsed = attributesSchema.safeParse({
    ...payload,
    notes: payload.notes || undefined,
  });
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { error: first ?? "Invalid input." };
  }

  const { notes, ...attrValues } = parsed.data;

  const base = {
    player_id:   playerId,
    coach_id:    user.id,
    notes:       notes ?? null,
    assessed_at: new Date().toISOString(),
  };

  // Only the attributes the form actually showed are written. Columns left out
  // keep whatever they already held (PostgREST's upsert updates named columns
  // only), so a goalkeeper's row never gains a fabricated "Shooting: 50" for an
  // attribute their coach was never asked about.
  const { error } = await supabase
    .from("player_attributes")
    .upsert({ ...base, ...attrValues }, { onConflict: "player_id,coach_id" });

  if (!error) {
    revalidatePath(`/dashboard/coach/squad/${playerId}`);
    return { success: true };
  }

  // Migration 013 was never applied to this project (or PostgREST is still
  // serving a cache from before it was), so the expanded columns don't exist.
  // Retry with the six the original schema guarantees rather than throwing the
  // coach's whole assessment away, and say what needs fixing.
  if (!isMissingAttributeColumn(error)) return { error: error.message };

  const core: Partial<Record<AttrKey, number>> = {};
  for (const key of CORE_ATTR_KEYS) {
    const value = attrValues[key];
    if (typeof value === "number") core[key] = value;
  }

  const { error: coreError } = await supabase
    .from("player_attributes")
    .upsert({ ...base, ...core }, { onConflict: "player_id,coach_id" });

  if (coreError) return { error: coreError.message };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true, warning: MISSING_ATTR_COLUMNS_MESSAGE };
}
