"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";

const updateRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().max(200).optional(),
});

export async function addStandaloneRating(
  playerId: string,
  payload: { rating: number; note?: string }
) {
  const { supabase, user } = await requireUser();

  const parsed = updateRatingSchema.safeParse({
    rating: payload.rating,
    note: payload.note || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.rating?.[0] ?? "Invalid input." };
  }

  const { error } = await supabase
    .from("player_ratings")
    .insert({
      player_id: playerId,
      coach_id: user.id,
      fixture_id: null,
      rating: parsed.data.rating,
      note: parsed.data.note ?? null,
    });

  if (error) return { error: friendlyError(error) };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}

export async function updateRating(
  ratingId: string,
  playerId: string,
  payload: { rating: number; note: string }
) {
  const { supabase, user } = await requireUser();

  const parsed = updateRatingSchema.safeParse({
    rating: payload.rating,
    note: payload.note || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.rating?.[0] ?? "Invalid input." };
  }

  // Verify this rating belongs to the requesting coach before updating
  const { data: existing } = await supabase
    .from("player_ratings")
    .select("id")
    .eq("id", ratingId)
    .eq("coach_id", user.id)
    .single();

  if (!existing) return { error: "Rating not found or access denied." };

  const { error } = await supabase
    .from("player_ratings")
    .update({ rating: parsed.data.rating, note: parsed.data.note ?? null })
    .eq("id", ratingId);

  if (error) return { error: friendlyError(error) };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}

export async function deleteRating(ratingId: string, playerId: string) {
  const { supabase, user } = await requireUser();

  // Verify this rating belongs to the requesting coach before deleting
  const { data: existing } = await supabase
    .from("player_ratings")
    .select("id")
    .eq("id", ratingId)
    .eq("coach_id", user.id)
    .single();

  if (!existing) return { error: "Rating not found or access denied." };

  const { error } = await supabase
    .from("player_ratings")
    .delete()
    .eq("id", ratingId);

  if (error) return { error: friendlyError(error) };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}
