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
  pace:             z.number().int().min(1).max(99),
  shooting:         z.number().int().min(1).max(99),
  passing:          z.number().int().min(1).max(99),
  dribbling:        z.number().int().min(1).max(99),
  defending:        z.number().int().min(1).max(99),
  physical:         z.number().int().min(1).max(99),
  notes:            z.string().max(300).optional(),
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
  payload: {
    pace: number; shooting: number; passing: number;
    dribbling: number; defending: number; physical: number;
    notes?: string;
    ball_control?: number; crossing?: number; heading?: number;
    tackling?: number; finishing?: number; first_touch?: number;
    stamina?: number; agility?: number; jumping?: number; strength?: number;
    positioning?: number; decision_making?: number; composure?: number;
    work_rate?: number; leadership?: number; shot_stopping?: number;
    reflexes?: number; distribution?: number; handling?: number;
  }
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

  const base = {
    player_id:   playerId,
    coach_id:    user.id,
    notes:       parsed.data.notes ?? null,
    assessed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("player_attributes")
    .upsert({ ...base, ...parsed.data, notes: base.notes }, { onConflict: "player_id,coach_id" });

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
  for (const key of CORE_ATTR_KEYS) core[key] = parsed.data[key];

  const { error: coreError } = await supabase
    .from("player_attributes")
    .upsert({ ...base, ...core }, { onConflict: "player_id,coach_id" });

  if (coreError) return { error: coreError.message };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true, warning: MISSING_ATTR_COLUMNS_MESSAGE };
}
