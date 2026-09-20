"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";

export async function markMatchAttendance(
  fixtureId: string,
  playerId: string,
  status: "present" | "absent" | "late" | "excused"
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("match_attendance").upsert(
    {
      fixture_id: fixtureId,
      player_id: playerId,
      status,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
    },
    { onConflict: "fixture_id,player_id" }
  );

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/fixtures/${fixtureId}`, "page");
  return { success: true };
}

export async function markTrainingAttendance(
  sessionId: string,
  playerId: string,
  status: "present" | "absent"
) {
  const { supabase, user } = await requireUser();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("coach_id", user.id)
    .single();

  if (!session) return { error: "Session not found or access denied." };

  const { error } = await supabase.from("training_attendance").upsert(
    {
      session_id: sessionId,
      player_id: playerId,
      status,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
    },
    { onConflict: "session_id,player_id" }
  );

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/training/${sessionId}`);
  return { success: true };
}
