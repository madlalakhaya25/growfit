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

  if (storageErr) return { error: storageErr.message };

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

  if (insertErr) return { error: insertErr.message };

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

  // Extract storage path from public URL (everything after /academy-media/)
  const urlParts = mediaRow.url.split("/academy-media/");
  const storagePath = urlParts[1];

  if (storagePath) {
    await supabase.storage.from("academy-media").remove([storagePath]);
  }

  const { error: deleteErr } = await supabase
    .from("media_uploads")
    .delete()
    .eq("id", mediaId);

  if (deleteErr) return { error: deleteErr.message };

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
