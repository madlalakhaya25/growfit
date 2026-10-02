"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { suggestTerms, termProblem } from "@/lib/school-terms";

async function adminContext() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id || profile.role !== "admin") return null;
  return { supabase, academyId: profile.academy_id as string };
}

/** One tap: add the four suggested terms for a year. Terms already there (same start date) are left alone. */
export async function createSuggestedTerms(year: number) {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };
  if (!Number.isInteger(year) || year < 2023 || year > 2100) return { error: "Choose a year between 2023 and 2100." };

  const { terms, approximate } = suggestTerms(year);
  const { error } = await ctx.supabase
    .from("academy_terms")
    .upsert(
      terms.map((t) => ({ ...t, academy_id: ctx.academyId })),
      { onConflict: "academy_id,starts_on", ignoreDuplicates: true }
    );
  if (error) return { error: friendlyError(error) };

  revalidatePath("/dashboard/admin/academy");
  return { success: true, approximate };
}

export async function saveTerm(prevState: unknown, formData: FormData) {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };

  const term = {
    name: String(formData.get("name") ?? "").trim(),
    starts_on: String(formData.get("starts_on") ?? ""),
    ends_on: String(formData.get("ends_on") ?? ""),
  };
  const problem = termProblem(term);
  if (problem) return { error: problem };

  const id = String(formData.get("id") ?? "");
  const query = id
    ? ctx.supabase.from("academy_terms").update(term).eq("id", id).eq("academy_id", ctx.academyId)
    : ctx.supabase.from("academy_terms").insert({ ...term, academy_id: ctx.academyId });
  const { error } = await query;
  if (error) return { error: friendlyError(error) };

  revalidatePath("/dashboard/admin/academy");
  return { success: true };
}

export async function deleteTerm(id: string) {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("academy_terms")
    .delete()
    .eq("id", id)
    .eq("academy_id", ctx.academyId);
  if (error) return { error: friendlyError(error) };

  revalidatePath("/dashboard/admin/academy");
  return { success: true };
}
