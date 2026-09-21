"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import {
  isLegacyAttendanceConstraint,
  LEGACY_ATTENDANCE_CONSTRAINT_MESSAGE,
  type AttendanceStatus,
} from "@/lib/attendance";
import { reportError } from "@/lib/report-error";

export async function markMatchAttendance(
  fixtureId: string,
  playerId: string,
  status: AttendanceStatus
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

/**
 * Mark one player's training attendance.
 *
 * Accepts the full P/A/L/E set, matching the academy's policy and what
 * `markMatchAttendance` above has always accepted. The training side was
 * limited to present/absent, so "late" and "excused" had nowhere to go and
 * registered as absences against the 75% welfare threshold.
 */
export async function markTrainingAttendance(
  sessionId: string,
  playerId: string,
  status: AttendanceStatus
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

  if (error) {
    // Until migration 036 runs, this table still carries migration 005's RSVP
    // constraint (`'attending' | 'unavailable'`) and every write fails with
    // 23514. The raw message reads as an app bug; name the actual remedy.
    if (isLegacyAttendanceConstraint(error)) {
      reportError(error, { scope: "markTrainingAttendance", extra: { cause: "pre-036 CHECK constraint" } });
      return { error: LEGACY_ATTENDANCE_CONSTRAINT_MESSAGE };
    }
    return { error: friendlyError(error) };
  }
  revalidatePath(`/dashboard/coach/training/${sessionId}`);
  revalidatePath("/dashboard/coach/welfare");
  return { success: true };
}
