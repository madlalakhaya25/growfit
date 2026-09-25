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

export async function updateAcademyFeatures(prevState: unknown, formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id || profile.role !== "admin") return { error: "Unauthorized" };

  const features = {
    tactics: formData.get("tactics") === "on",
    film: formData.get("film") === "on",
    assistant: formData.get("assistant") === "on",
  };

  const { error } = await supabase
    .from("academies")
    .update({ features })
    .eq("id", profile.academy_id);

  if (error) return { error: friendlyError(error) };

  revalidatePath("/dashboard/admin/academy");
  // The nav's `features` come from the protected layout, above every page --
  // a plain revalidatePath on the settings page alone leaves stale flags
  // in the sidebar/bottom-nav until the user's next full navigation.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
