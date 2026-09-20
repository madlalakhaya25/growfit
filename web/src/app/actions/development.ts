"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { Position } from "@/lib/types";
import { friendlyError } from "@/lib/friendly-error";

export type MilestoneCategory = "technical" | "tactical" | "physical" | "mental" | "leadership";

export type MilestoneTemplateData = {
  title: string;
  description: string;
  category: MilestoneCategory;
  position: Position | null;
  age_group: string | null;
  sort_order: number;
};

export async function saveMilestoneTemplate(
  academyId: string,
  data: MilestoneTemplateData & { id?: string }
) {
  const { supabase } = await requireUser();

  const payload = {
    academy_id: academyId,
    title: data.title,
    description: data.description,
    category: data.category,
    position: data.position ?? null,
    age_group: data.age_group ?? null,
    sort_order: data.sort_order,
  };

  let error;
  if (data.id) {
    ({ error } = await supabase
      .from("development_milestone_templates")
      .update(payload)
      .eq("id", data.id)
      .eq("academy_id", academyId));
  } else {
    ({ error } = await supabase
      .from("development_milestone_templates")
      .insert(payload));
  }

  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/admin/development", "page");
  return { success: true };
}

export async function deleteMilestoneTemplate(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("development_milestone_templates")
    .delete()
    .eq("id", id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/admin/development", "page");
  return { success: true };
}

export async function toggleMilestoneCompletion(
  templateId: string,
  playerId: string,
  season: string,
  completed: boolean,
  note?: string
) {
  const { supabase, user } = await requireUser();

  if (completed) {
    const { error } = await supabase
      .from("player_milestone_completions")
      .upsert(
        {
          template_id: templateId,
          player_id: playerId,
          season,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          note: note ?? null,
        },
        { onConflict: "template_id,player_id,season" }
      );
    if (error) return { error: friendlyError(error) };
  } else {
    const { error } = await supabase
      .from("player_milestone_completions")
      .delete()
      .eq("template_id", templateId)
      .eq("player_id", playerId)
      .eq("season", season);
    if (error) return { error: friendlyError(error) };
  }

  revalidatePath(`/dashboard/coach/squad/${playerId}`, "page");
  return { success: true };
}
