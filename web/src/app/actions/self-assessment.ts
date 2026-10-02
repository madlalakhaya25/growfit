"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";
import { isSelfRating } from "@/lib/self-assessment";

/** A player rates themself in one category this term. Only ever their own row. */
export async function saveSelfAssessment(termId: string, category: string, rating: number) {
  const { supabase, user } = await requireUser();
  if (!(MILESTONE_CATEGORIES as readonly string[]).includes(category)) return { error: "Unknown category." };
  if (!isSelfRating(rating)) return { error: "Choose one of the five answers." };

  const { data: player } = await supabase
    .from("players")
    .select("id, academy_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!player) return { error: "Only players can rate themselves." };

  const { data: term } = await supabase
    .from("academy_terms")
    .select("id")
    .eq("id", termId)
    .eq("academy_id", player.academy_id)
    .maybeSingle();
  if (!term) return { error: "That term was not found." };

  const { error } = await supabase
    .from("player_self_assessments")
    .upsert(
      { player_id: player.id, term_id: termId, category, rating, updated_at: new Date().toISOString() },
      { onConflict: "player_id,term_id,category" }
    );
  if (error) return { error: friendlyError(error) };

  revalidatePath("/dashboard/player/development");
  return { success: true };
}
