"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function claimPlayerProfile(formData: FormData) {
  const { supabase } = await requireUser();

  const token = (formData.get("share_token") as string ?? "").toLowerCase().trim();
  if (!token) return { error: "Share token is required." };

  // Use a SECURITY DEFINER RPC so the lookup works regardless of whether
  // the player's profile has academy_id populated yet (migration 004)
  const { data, error } = await supabase.rpc("claim_player_profile", {
    p_share_token: token,
  });

  if (error) return { error: error.message };

  const result = data as { error?: string; success?: boolean };
  if (result?.error) return { error: result.error };

  redirect("/dashboard/player");
}

/**
 * Claim a player record that was created from a registration PDF.
 *
 * Imported players never receive a share token, so they cannot use
 * claimPlayerProfile. Date of birth is required alongside the registration
 * number as a second factor — these are children's records and a SAFA number
 * alone is knowable by others.
 */
export async function claimPlayerByRegistration(formData: FormData) {
  const { supabase } = await requireUser();

  const number = ((formData.get("reg_number") as string) ?? "").trim();
  const dob = ((formData.get("date_of_birth") as string) ?? "").trim();
  if (!number) return { error: "Enter your SAFA or FIFA registration number." };
  if (!dob) return { error: "Enter your date of birth." };

  const { data, error } = await supabase.rpc("claim_player_by_registration", {
    p_number: number,
    p_date_of_birth: dob,
  });

  if (error) return { error: error.message };
  const result = data as { error?: string; success?: boolean };
  if (result?.error) return { error: result.error };

  redirect("/dashboard/player");
}
