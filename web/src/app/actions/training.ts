"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import type { AttendanceStatus } from "@/lib/attendance";

const sessionSchema = z.object({
  team_id: z.string().uuid("Invalid team"),
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  session_date: z.string().min(1, "Date is required"),
  location: z.string().max(120).optional(),
  session_type: z.enum(["general", "technical", "tactical", "fitness", "match_prep", "recovery"]),
  notes: z.string().max(1000).optional(),
});

const drillSchema = z.object({
  session_id: z.string().uuid("Invalid session"),
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  description: z.string().max(500).optional(),
  video_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

// Not redundant with RLS: since migration 038, `training_sessions`'s policy
// checks `is_admin_or_coach()` + academy match, not which team a coach
// specifically coaches, so this app-level filter is the only thing stopping
// one coach from writing another coach's sessions. Audited as part of
// docs/BACKLOG.md 1.5; don't remove this as "redundant" without re-checking
// the actual RLS policy first.
async function getCoachTeamIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("teams")
    .select("id")
    .in("id", await getCoachedTeamIds(supabase, userId))
    .eq("active", true);
  return (data ?? []).map((t: { id: string }) => t.id);
}

export async function createTrainingSession(formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = {
    team_id: formData.get("team_id") as string,
    title: formData.get("title") as string,
    session_date: formData.get("session_date") as string,
    location: (formData.get("location") as string) || undefined,
    session_type: formData.get("session_type") as string,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.includes(parsed.data.team_id)) return { error: "Team not found." };

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: parsed.data.team_id,
      coach_id: user.id,
      title: parsed.data.title,
      session_date: parsed.data.session_date,
      location: parsed.data.location ?? null,
      session_type: parsed.data.session_type,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create session." };
  revalidatePath("/dashboard/coach/training", "page");
  redirect(`/dashboard/coach/training/${data.id}`);
}

export async function createTrainingSessionWithDrills(params: {
  team_id: string;
  title: string;
  session_date: string;
  location?: string;
  session_type: string;
  notes?: string;
  drills: { title: string; description?: string; video_url?: string }[];
}): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();

  const parsed = sessionSchema.safeParse({
    team_id: params.team_id,
    title: params.title,
    session_date: params.session_date,
    location: params.location || undefined,
    session_type: params.session_type,
    notes: params.notes || undefined,
  });

  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.includes(parsed.data.team_id)) return { error: "Team not found." };

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: parsed.data.team_id,
      coach_id: user.id,
      title: parsed.data.title,
      session_date: parsed.data.session_date,
      location: parsed.data.location ?? null,
      session_type: parsed.data.session_type,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create session." };

  if (params.drills.length > 0) {
    const drillRows = params.drills.map((d, i) => ({
      session_id: data.id,
      title: d.title,
      description: d.description || null,
      video_url: d.video_url || null,
      sort_order: i,
    }));
    const { error: drillError } = await supabase.from("training_drills").insert(drillRows);
    if (drillError) return { error: friendlyError(drillError) };
  }

  revalidatePath("/dashboard/coach/training", "page");
  return { id: data.id };
}

/**
 * Edit a training session's details.
 *
 * Sessions could be created and deleted but never edited, so a wrong date,
 * a venue change or a corrected title meant deleting the session — which
 * takes its drills AND any attendance already marked against it with it —
 * and building the whole thing again. Attendance is what feeds the 75%
 * welfare threshold, so that was not a cosmetic loss.
 *
 * The team is deliberately not editable: moving a session to another squad
 * would orphan the attendance already recorded for the first one.
 */
export async function updateTrainingSession(sessionId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const parsed = sessionSchema.omit({ team_id: true }).safeParse({
    title: formData.get("title") as string,
    session_date: formData.get("session_date") as string,
    location: (formData.get("location") as string) || undefined,
    session_type: formData.get("session_type") as string,
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  // `.select("id")` so a zero-row update is caught: an UPDATE matching
  // nothing is not a PostgREST error, and reading the absent error as
  // success is how the admin team edit silently did nothing.
  const { data, error } = await supabase
    .from("training_sessions")
    .update({
      title: parsed.data.title,
      session_date: parsed.data.session_date,
      location: parsed.data.location ?? null,
      session_type: parsed.data.session_type,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", sessionId)
    .in("team_id", teamIds)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Session not found." };

  revalidatePath("/dashboard/coach/training", "page");
  revalidatePath(`/dashboard/coach/training/${sessionId}`, "page");
  // Players see their own training list too.
  revalidatePath("/dashboard/player/training", "page");
  return { success: true };
}

export async function deleteTrainingSession(id: string) {
  const { supabase, user } = await requireUser();

  // Scoped to teams the caller coaches, not to who personally created the
  // session — team_coaches (migration 019) makes a session's team, not its
  // creator, the actual unit of ownership; see migration 038.
  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  const { data, error } = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", id)
    .in("team_id", teamIds)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Session not found." };
  revalidatePath("/dashboard/coach/training", "page");
  return { success: true };
}

export async function addDrill(formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = {
    session_id: formData.get("session_id") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    video_url: (formData.get("video_url") as string) || undefined,
  };

  const parsed = drillSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  // Verify the caller coaches this session's team — not that they personally
  // created it. A co-coach on the same team may add drills to a colleague's
  // session; see migration 038.
  const teamIds = await getCoachTeamIds(supabase, user.id);
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", parsed.data.session_id)
    .in("team_id", teamIds)
    .single();

  if (!session) return { error: "Session not found." };

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("training_drills")
    .select("sort_order")
    .eq("session_id", parsed.data.session_id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("training_drills").insert({
    session_id: parsed.data.session_id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    video_url: parsed.data.video_url || null,
    sort_order: nextOrder,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/training/${parsed.data.session_id}`, "page");
  return { success: true };
}

export async function deleteDrill(drillId: string, sessionId: string) {
  const { supabase, user } = await requireUser();

  // RLS enforces team-coach access (migration 038) — delete will no-op if
  // the caller doesn't coach this session's team.
  const { data, error } = await supabase
    .from("training_drills")
    .delete()
    .eq("id", drillId)
    .select("id");

  // Verify session access separately to give a meaningful error — scoped to
  // teams the caller coaches, not to who created the session.
  if (!data?.length) {
    const teamIds = await getCoachTeamIds(supabase, user.id);
    const { data: session } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("id", sessionId)
      .in("team_id", teamIds)
      .single();
    if (!session) return { error: "Drill not found or access denied." };
  }

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/training/${sessionId}`, "page");
  return { success: true };
}

export async function setAttendance(sessionId: string, status: "attending" | "unavailable") {
  const { supabase, user } = await requireUser();

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
    .single();

  if (!player) return { error: "Player profile not found." };

  // `training_attendance.status` has taken the shared P/A/L/E vocabulary
  // since migration 036 — writing this function's own "attending" /
  // "unavailable" RSVP values straight through violates the CHECK
  // constraint on every call (23514), which is exactly the bug 036 fixed
  // for the coach-marking path but missed here, on this older player RSVP
  // path into the same column. Translated the same way 036 itself
  // translated the historical rows: an RSVP to attend is the closest thing
  // to a present mark; "I can't make it" is an absence the coach knows
  // about in advance, i.e. excused rather than a plain absence.
  const dbStatus: AttendanceStatus = status === "attending" ? "present" : "excused";

  const { error } = await supabase.from("training_attendance").upsert(
    { session_id: sessionId, player_id: player.id, status: dbStatus },
    { onConflict: "session_id,player_id" }
  );

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/player/training/${sessionId}`, "page");
  revalidatePath(`/dashboard/coach/training/${sessionId}`, "page");
  return { success: true };
}
