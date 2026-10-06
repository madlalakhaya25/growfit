"use server";
import { revalidatePath } from "next/cache";
import { adminContext } from "@/lib/admin-context";
import { friendlyError } from "@/lib/friendly-error";
import { isStaffHat } from "@/lib/staff-hats";
import { isMissingHatsTable } from "@/lib/staff-hats-data";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Give a staff member a hat, or take it off. Admins only. A hat only chooses
 * which cards someone sees; it grants no access to anything.
 */
export async function setStaffHat(profileId: string, hat: string, on: boolean) {
  const ctx = await adminContext();
  if (!ctx) return { error: "Unauthorized" };
  if (!UUID_RE.test(profileId) || !isStaffHat(hat)) return { error: "Choose a person and a hat." };

  const result = on
    ? await ctx.supabase.from("staff_hats").insert({
        profile_id: profileId,
        academy_id: ctx.academyId,
        hat,
        created_by: ctx.userId,
      })
    : await ctx.supabase.from("staff_hats").delete().eq("profile_id", profileId).eq("academy_id", ctx.academyId).eq("hat", hat);

  // Already wearing it is the state asked for, so it is not an error.
  if (result.error && result.error.code !== "23505") {
    if (isMissingHatsTable(result.error)) return { error: "Staff hats are not set up yet." };
    return { error: friendlyError(result.error) };
  }

  revalidatePath("/dashboard/admin/academy");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/coach");
  return { success: true };
}
