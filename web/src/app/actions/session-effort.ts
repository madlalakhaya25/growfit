"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { EFFORT_LEVELS, EFFORT_STATUSES } from "@/lib/session-effort";

const NOT_YET = "Effort ratings need a database update that hasn't been run yet. Ask your academy admin to run migration 057.";

/**
 * Set how hard a session was for every child who came to it (present or late).
 * Children who were absent or excused did no work and are left alone, as is
 * anyone not yet marked. Re-rating overwrites, so a coach can correct a tap.
 */
export async function rateSessionEffort(sessionId: string, rpe: number): Promise<{ success?: boolean; count?: number; error?: string }> {
  if (!EFFORT_LEVELS.some((l) => l.rpe === rpe)) return { error: "Pick Easy, Okay, Hard or Very hard." };
  const { supabase, user } = await requireUser();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
    .single();
  if (!session) return { error: "Session not found or access denied." };

  const { data, error } = await supabase
    .from("training_attendance")
    .update({ rpe })
    .eq("session_id", sessionId)
    .in("status", EFFORT_STATUSES)
    .select("player_id");
  if (error) {
    if (error.code === "PGRST204" || error.code === "42703") return { error: NOT_YET };
    return { error: friendlyError(error) };
  }
  revalidatePath(`/dashboard/coach/training/${sessionId}`);
  revalidatePath("/dashboard/coach/squad");
  return { success: true, count: (data ?? []).length };
}
