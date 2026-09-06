"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/**
 * Lets a parent (or the player themself) remove their own child's photo —
 * previously there was no delete path for it at all. Removes the actual
 * object from the player-photos bucket first (best-effort — an orphaned
 * object with photo_url already cleared is merely unreferenced, not
 * exposed), then clears the column via a narrow SECURITY DEFINER RPC that
 * checks the caller is actually this player's parent or the player
 * themself (see migration 025).
 */
export async function removeOwnChildPhoto(playerId: string) {
  const { supabase } = await requireUser();

  const { data: player } = await supabase
    .from("players")
    .select("photo_url")
    .eq("id", playerId)
    .maybeSingle();

  if (player?.photo_url) {
    const marker = "/player-photos/";
    const idx = player.photo_url.indexOf(marker);
    if (idx !== -1) {
      const path = player.photo_url.slice(idx + marker.length);
      await supabase.storage.from("player-photos").remove([path]);
    }
  }

  const { data, error } = await supabase.rpc("delete_player_photo", { p_player_id: playerId });
  if (error) return { error: error.message };

  const result = data as { error?: string; success?: boolean };
  if (result?.error) return { error: result.error };

  revalidatePath("/dashboard/parent", "page");
  revalidatePath(`/dashboard/parent/${playerId}`, "page");
  revalidatePath("/dashboard/player", "page");
  return { success: true };
}
