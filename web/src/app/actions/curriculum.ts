"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { cleanCurriculumInput, nextSortOrder, swapWithNeighbour } from "@/lib/curriculum";
import { loadCurriculum } from "@/lib/curriculum-data";

const PATH = "/dashboard/admin/academy";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

// Writing is for admins only; row security says the same, this just gives a
// plain answer instead of a database error.
async function adminContext() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id || profile.role !== "admin") return null;
  return { supabase, userId: user.id, academyId: profile.academy_id as string };
}

/** Add one item to the end of its age group and category. The academy writes every word. */
export async function addCurriculumItem(prevState: unknown, formData: FormData) {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };

  const input = cleanCurriculumInput({
    ageGroup: text(formData, "age_group"),
    category: text(formData, "category"),
    title: text(formData, "title"),
    description: text(formData, "description"),
  });
  if (!input) return { error: "Choose an age group and a heading, and write a title of up to 200 characters (a description of up to 600)." };

  const { available, items } = await loadCurriculum(ctx.supabase);
  if (!available) return { error: "Curriculum is not set up yet." };
  const sameTitle = items.some(
    (i) => i.ageGroup === input.ageGroup && i.category === input.category && i.title.toLowerCase() === input.title.toLowerCase(),
  );
  if (sameTitle) return { error: "That item is already in this list." };

  const { error } = await ctx.supabase.from("curriculum_items").insert({
    academy_id: ctx.academyId,
    age_group: input.ageGroup,
    category: input.category,
    title: input.title,
    description: input.description,
    sort_order: nextSortOrder(items, input.ageGroup, input.category),
    created_by: ctx.userId,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath(PATH);
  return { success: true };
}

/** Retire an item (kept for history, hidden from the list) or bring it back. */
export async function setCurriculumItemActive(id: string, active: boolean) {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("curriculum_items")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("academy_id", ctx.academyId);
  if (error) return { error: friendlyError(error) };

  revalidatePath(PATH);
  return { success: true };
}

export async function moveCurriculumItem(id: string, direction: "up" | "down") {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };
  if (direction !== "up" && direction !== "down") return { error: "Choose up or down." };

  const { items } = await loadCurriculum(ctx.supabase);
  const moves = swapWithNeighbour(items, id, direction);
  if (!moves) return { success: true };

  for (const m of moves) {
    const { error } = await ctx.supabase
      .from("curriculum_items")
      .update({ sort_order: m.sortOrder })
      .eq("id", m.id)
      .eq("academy_id", ctx.academyId);
    if (error) return { error: friendlyError(error) };
  }

  revalidatePath(PATH);
  return { success: true };
}
