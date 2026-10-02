"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { coachesPlayer } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";
import { isBand } from "@/lib/term-review";

/** Place a player in a band for one category this term. Saving the same band again is harmless. */
export async function saveTermReview(playerId: string, termId: string, category: string, band: number) {
  const { supabase, user, profile } = await requireStaff();
  if (!profile) return { error: "Only coaches can review a term." };
  if (!(MILESTONE_CATEGORIES as readonly string[]).includes(category)) return { error: "Unknown category." };
  if (!isBand(band)) return { error: "Choose one of the four bands." };

  const allowed = await coachesPlayer(supabase, { userId: user.id, role: profile.role, playerId });
  if (!allowed) return { error: "You can only review players on your teams." };

  const { data: term } = await supabase
    .from("academy_terms")
    .select("id")
    .eq("id", termId)
    .eq("academy_id", profile.academy_id)
    .maybeSingle();
  if (!term) return { error: "That term was not found." };

  const { error } = await supabase
    .from("player_term_reviews")
    .upsert(
      { player_id: playerId, term_id: termId, category, band, reviewed_by: user.id, reviewed_at: new Date().toISOString() },
      { onConflict: "player_id,term_id,category" }
    );
  if (error) return { error: friendlyError(error) };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}
