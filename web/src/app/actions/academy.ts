"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";

export async function updateAcademyInfo(prevState: unknown, formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id || profile.role !== "admin") return { error: "Unauthorized" };

  const name     = (formData.get("name") as string)?.trim();
  const province = (formData.get("province") as string)?.trim() || null;

  if (!name || name.length < 2) return { error: "Club name must be at least 2 characters." };

  const { error } = await supabase
    .from("academies")
    .update({ name, province })
    .eq("id", profile.academy_id);

  if (error) return { error: friendlyError(error) };

  revalidatePath("/dashboard/admin/academy");
  return { success: true };
}
