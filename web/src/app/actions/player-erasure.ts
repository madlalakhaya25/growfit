"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { deleteAgeRewritesMentioning, deleteAiArtefactsForSubject, deletePlayRolesForPlayer } from "@/lib/ai-artefacts";
import { deleteCoachNotesForPlayer } from "@/lib/coach-notes";

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

  const stuck = await eraseDataWithoutForeignKey(supabase, playerId, profile.academy_id, player.full_name);
  if (stuck) return { error: stuck };

  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: friendlyError(error) };

  redirect("/dashboard/admin/players");
}

/**
 * The tables that name a player without a foreign key, so deleting the player
 * does not reach them (ai_artefacts, migration 045; coach_notes, migration
 * 056). An erased child's AI-written profile or a coach's note about them
 * surviving would defeat the erasure, so this runs first and a failure stops
 * the whole thing rather than leaving orphans. Returns the message to show, or
 * null when everything is gone.
 */
async function eraseDataWithoutForeignKey(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  playerId: string,
  academyId: string,
  fullName: string
): Promise<string | null> {
  const aiFailed = "Couldn't erase this player's saved AI output — nothing was deleted.";
  const artefacts = await deleteAiArtefactsForSubject(supabase, { subjectType: "player", subjectId: playerId });
  if (!artefacts.deleted) return aiFailed;
  // "My job in this play" sets are keyed by play, not by player, and carry the
  // player's first name; deleting the player does not reach them.
  const playRoles = await deletePlayRolesForPlayer(supabase, playerId);
  if (!playRoles.deleted) return aiFailed;
  // A coach's note simplified for a child is cached by its text, not its player.
  const rewrites = await deleteAgeRewritesMentioning(supabase, academyId, fullName);
  if (!rewrites.deleted) return aiFailed;
  const notes = await deleteCoachNotesForPlayer(supabase, playerId);
  if (!notes.deleted) return "Couldn't erase the coach notes about this player — nothing was deleted.";
  return null;
}
