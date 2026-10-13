"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import {
  isAttendanceStatus,
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
 * Save a batch of training register marks in one write.
 *
 * The register keeps taps on the phone and sends them here together, a moment
 * after the coach stops tapping (and at once for "mark remaining present").
 * One tap used to be one Server Action, and Next.js runs those one at a time,
 * so twenty quick taps queued twenty round trips plus twenty page re-renders.
 *
 * Deliberately does not revalidate the session page: the coach is looking at
 * it, and the register already shows what was tapped.
 */
export async function saveTrainingRegister(
  sessionId: string,
  marks: { playerId: string; status: AttendanceStatus }[]
) {
  const { supabase, user } = await requireUser();

  // Last mark per player wins; anything that is not a known status is dropped.
  const latest = new Map<string, AttendanceStatus>();
  for (const m of marks.slice(0, 200)) {
    if (typeof m?.playerId === "string" && isAttendanceStatus(m.status)) latest.set(m.playerId, m.status);
  }
  if (latest.size === 0) return { success: true };

  // Scoped to teams the caller coaches, not to who created the session —
  // same reasoning as markTrainingAttendance above; see migration 038.
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
    .single();

  if (!session) return { error: "Session not found or access denied." };

  const markedAt = new Date().toISOString();
  const { error } = await supabase.from("training_attendance").upsert(
    [...latest].map(([playerId, status]) => ({
      session_id: sessionId,
      player_id: playerId,
      status,
      marked_by: user.id,
      marked_at: markedAt,
    })),
    { onConflict: "session_id,player_id" }
  );

  if (error) {
    if (isLegacyAttendanceConstraint(error)) {
      reportError(error, { scope: "saveTrainingRegister", extra: { cause: "pre-036 CHECK constraint" } });
      return { error: LEGACY_ATTENDANCE_CONSTRAINT_MESSAGE };
    }
    return { error: friendlyError(error) };
  }
  revalidatePath("/dashboard/coach/welfare");
  revalidatePath("/dashboard/coach");
  return { success: true };
}
