"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";

export async function uploadMedia(formData: FormData) {
  const { supabase, user } = await requireUser();

  const academy_id = formData.get("academy_id") as string;
  const team_id = formData.get("team_id") as string;
  const session_id = formData.get("session_id") as string | null;
  const fixture_id = formData.get("fixture_id") as string | null;
  const caption = formData.get("caption") as string | null;
  const file = formData.get("file") as File | null;
  const player_id = formData.get("player_id") as string | null;

  if (!file || !file.size) return { error: "No file selected." };
  if (file.size > 20 * 1024 * 1024) return { error: "File must be under 20 MB." };
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return { error: "Only image and video files are allowed." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${academy_id}/${Date.now()}-${safeName}`;

  const { error: storageErr } = await supabase.storage
    .from("academy-media")
    .upload(path, file, { contentType: file.type });

  if (storageErr) return { error: friendlyError(storageErr, "Couldn't upload that file.") };

  const {
    data: { publicUrl },
  } = supabase.storage.from("academy-media").getPublicUrl(path);

  const { data: mediaRow, error: insertErr } = await supabase
    .from("media_uploads")
    .insert({
      academy_id,
      team_id: team_id || null,
      session_id: session_id || null,
      fixture_id: fixture_id || null,
      uploaded_by: user.id,
      url: publicUrl,
      media_type: file.type.startsWith("video/") ? "video" : "photo",
      caption: caption || null,
    })
    .select("id")
    .single();

  if (insertErr) return { error: friendlyError(insertErr) };

  if (player_id && mediaRow) {
    await supabase
      .from("media_tags")
      .insert({ media_id: mediaRow.id, player_id });
  }

  if (session_id) {
    revalidatePath(`/dashboard/coach/training/${session_id}`);
  }
  if (fixture_id) {
    revalidatePath(`/dashboard/coach/fixtures/${fixture_id}`);
  }

  return { success: true, url: publicUrl };
}

export async function deleteMedia(mediaId: string) {
  const { supabase } = await requireUser();

  const { data: mediaRow, error: fetchErr } = await supabase
    .from("media_uploads")
    .select("url, session_id, fixture_id")
    .eq("id", mediaId)
    .single();

  if (fetchErr || !mediaRow) return { error: "Media not found." };

  // Delete the row FIRST, and only clear storage once a row actually went.
  //
  // This used to remove the storage object before the row, unconditionally.
  // RLS on media_uploads is `media_uploader_delete: uploaded_by =
  // auth.uid()` (migration 008), so a coach acting on a colleague's upload
  // matches zero rows — and a DELETE that matches nothing is not a
  // PostgREST error, just an empty result. The old order therefore deleted
  // the file, left the row pointing at it, and returned `{ success: true }`:
  // a broken thumbnail and a cheerful toast. Same silent-no-op shape as the
  // admin deleteTeam() bug, with data loss attached.
  const { data: deleted, error: deleteErr } = await supabase
    .from("media_uploads")
    .delete()
    .eq("id", mediaId)
    .select("id");

  if (deleteErr) return { error: friendlyError(deleteErr) };
  if (!deleted?.length) {
    return { error: "Only the person who uploaded this can delete it." };
  }

  // Extract storage path from public URL (everything after /academy-media/)
  const storagePath = mediaRow.url.split("/academy-media/")[1];
  if (storagePath) {
    const { error: storageErr } = await supabase.storage
      .from("academy-media")
      .remove([storagePath]);
    // The record is already gone, which is what the caller asked for. A
    // failure here leaves an unreferenced file, not a broken gallery — log
    // it rather than reporting a failed delete that did in fact happen.
    if (storageErr) {
      console.error("[media] row deleted but storage object remains:", storagePath, storageErr);
    }
  }

  if (mediaRow.session_id) {
    revalidatePath(`/dashboard/coach/training/${mediaRow.session_id}`);
  }
  if (mediaRow.fixture_id) {
    revalidatePath(`/dashboard/coach/fixtures/${mediaRow.fixture_id}`);
  }

  return { success: true };
}

export async function tagPlayer(mediaId: string, playerId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("media_tags")
    .upsert({ media_id: mediaId, player_id: playerId }, { onConflict: "media_id,player_id" });

  if (error) return { error: friendlyError(error) };
  return { success: true };
}
