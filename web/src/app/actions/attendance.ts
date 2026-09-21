"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { getCoachedTeamIds } from "@/lib/coached-teams";
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

  // Scoped to teams the caller coaches, not to who created the session — a
  // co-coach sharing this team may mark attendance too; see migration 038.
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
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

/**
 * One-tap "everyone's here" for training: upserts Present for every listed
 * player id in a single write, rather than the coach tapping Present once
 * per name. Callers pass only the currently-unmarked players, so this never
 * overwrites an exception (Late/Absent/Excused) already recorded — the
 * point is to make marking the common case (a full squad turning up) one
 * tap, and leave the coach tapping only the exceptions, not to make ticking
 * a genuine absence harder to correct afterwards.
 */
export async function markAllPresent(sessionId: string, playerIds: string[]) {
  const { supabase, user } = await requireUser();

  // Scoped to teams the caller coaches, not to who created the session —
  // same reasoning as markTrainingAttendance above; see migration 038.
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
    .single();

  if (!session) return { error: "Session not found or access denied." };
  if (playerIds.length === 0) return { success: true };

  const markedAt = new Date().toISOString();
  const { error } = await supabase.from("training_attendance").upsert(
    playerIds.map((playerId) => ({
      session_id: sessionId,
      player_id: playerId,
      status: "present" as const,
      marked_by: user.id,
      marked_at: markedAt,
    })),
    { onConflict: "session_id,player_id" }
  );

  if (error) {
    if (isLegacyAttendanceConstraint(error)) {
      reportError(error, { scope: "markAllPresent", extra: { cause: "pre-036 CHECK constraint" } });
      return { error: LEGACY_ATTENDANCE_CONSTRAINT_MESSAGE };
    }
    return { error: friendlyError(error) };
  }
  revalidatePath(`/dashboard/coach/training/${sessionId}`);
  revalidatePath("/dashboard/coach/welfare");
  return { success: true };
}
