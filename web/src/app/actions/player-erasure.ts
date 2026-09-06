"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

/**
 * Full erasure of a player's record — POPIA's right to erasure needs an
 * actual answer, and there was none. Admin-only, confirmed by the caller
 * having typed the player's exact name (checked here too, not just in the
 * form) since this is genuinely unrecoverable: every table referencing
 * players.id cascades on delete (migration 026).
 */
export async function deletePlayerRecord(playerId: string, confirmName: string) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") return { error: "Admins only." };

  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, photo_url")
    .eq("id", playerId)
    .eq("academy_id", profile.academy_id)
    .single();
  if (!player) return { error: "Player not found." };

  if (confirmName.trim().toLowerCase() !== player.full_name.trim().toLowerCase()) {
    return { error: "Name doesn't match — nothing was deleted." };
  }

  if (player.photo_url) {
    const marker = "/player-photos/";
    const idx = player.photo_url.indexOf(marker);
    if (idx !== -1) {
      await supabase.storage.from("player-photos").remove([player.photo_url.slice(idx + marker.length)]);
    }
  }

  const { data: docFiles } = await supabase.storage.from("player-documents").list(playerId);
  if (docFiles?.length) {
    for (const typeFolder of docFiles) {
      const { data: seasonFiles } = await supabase.storage
        .from("player-documents")
        .list(`${playerId}/${typeFolder.name}`);
      if (seasonFiles?.length) {
        await supabase.storage
          .from("player-documents")
          .remove(seasonFiles.map((f) => `${playerId}/${typeFolder.name}/${f.name}`));
      }
    }
  }

  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: error.message };

  redirect("/dashboard/admin/players");
}
