"use server";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/features";
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

  // "Use the simple menu" submits with every switch off, whatever is ticked.
  const simple = formData.get("simple") === "1";
  const features = Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, !simple && formData.get(key) === "on"])
  ) as Record<FeatureKey, boolean>;

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
