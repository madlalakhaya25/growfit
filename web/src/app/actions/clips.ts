"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";

export async function addPlayerClip(
  playerId: string,
  data: {
    title: string;
    url: string;
    fixture_id?: string;
    timestamp_seconds?: number;
    description?: string;
  }
) {
  const { supabase, user } = await requireUser();

  if (!data.title?.trim()) return { error: "Title is required." };
  if (!data.url?.trim()) return { error: "URL is required." };

  const { error } = await supabase.from("player_clips").insert({
    player_id: playerId,
    added_by: user.id,
    title: data.title.trim(),
    url: data.url.trim(),
    fixture_id: data.fixture_id ?? null,
    timestamp_seconds: data.timestamp_seconds ?? null,
    description: data.description?.trim() ?? null,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}

export async function deletePlayerClip(clipId: string, playerId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("player_clips").delete().eq("id", clipId);

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}
