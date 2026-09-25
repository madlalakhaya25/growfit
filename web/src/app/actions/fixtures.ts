"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFixtureSchema } from "@/lib/validation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";

// Not redundant with RLS: `fixture_staff_write`/`fixture_staff_update` only
// check `is_admin_or_coach()` + academy match, not which team a coach
// specifically coaches, so this app-level filter is the only thing stopping
// one coach from writing another coach's fixtures. Audited as part of
// docs/BACKLOG.md 1.5; don't remove this as "redundant" without re-checking
// the actual RLS policy first.
async function getCoachTeamIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .in("id", await getCoachedTeamIds(supabase, userId))
    .eq("active", true);
  return (teams ?? []).map((t: { id: string }) => t.id);
}

export async function createFixture(formData: FormData) {
  const { supabase, user } = await requireUser();

  const teamId = formData.get("team_id") as string;
  if (!teamId) return { error: "No team selected." };

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .single();

  if (!team) return { error: "Team not found." };

  const raw = {
    opponent: formData.get("opponent") as string,
    venue: (formData.get("venue") as string) || undefined,
    fixture_date: formData.get("fixture_date") as string,
    is_home: formData.get("is_home") === "true",
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = createFixtureSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const { error } = await supabase
    .from("fixtures")
    .insert({ ...parsed.data, team_id: teamId });

  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/coach/fixtures", "page");
  redirect(`/dashboard/coach/fixtures?team=${teamId}`);
}

/**
 * Edit a scheduled fixture.
 *
 * Fixtures could be created, cancelled and result-logged, but never
 * corrected — so a kickoff time typed wrong, or an opponent's name
 * misspelt, could only be fixed by cancelling (which notifies every parent
 * that the match is off, and demands a reason) and creating a new one.
 *
 * Reuses createFixtureSchema, so an edit cannot put a fixture into a state
 * a new one could not have been created in.
 */
export async function updateFixture(fixtureId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  const parsed = createFixtureSchema.safeParse({
    opponent: formData.get("opponent") as string,
    venue: (formData.get("venue") as string) || undefined,
    fixture_date: formData.get("fixture_date") as string,
    is_home: formData.get("is_home") === "true",
    notes: (formData.get("notes") as string) || undefined,
  });
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  // A completed fixture has a logged result hanging off it — appearances and
  // per-player ratings, written atomically by log_match_result(). Editing
  // the fixture underneath that would leave ratings attached to a match that
  // no longer describes what happened. A cancelled one is equally not a
  // thing to quietly reschedule: parents were told it was off.
  const { data: existing } = await supabase
    .from("fixtures")
    .select("status")
    .eq("id", fixtureId)
    .in("team_id", teamIds)
    .single();

  if (!existing) return { error: "Fixture not found." };
  if (existing.status === "completed") {
    return { error: "This match already has a result logged, so its details can't be changed." };
  }
  if (existing.status === "cancelled") {
    return { error: "This fixture is cancelled. Schedule a new one instead." };
  }

  const { data, error } = await supabase
    .from("fixtures")
    .update(parsed.data)
    .eq("id", fixtureId)
    .in("team_id", teamIds)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Fixture not found." };

  revalidatePath("/dashboard/coach/fixtures", "page");
  revalidatePath(`/dashboard/coach/fixtures/${fixtureId}`, "page");
  // Parents and players see fixtures too — a corrected kickoff time is no
  // use if their own list still shows the old one.
  revalidatePath("/dashboard/parent/fixtures", "page");
  revalidatePath("/dashboard/player/fixtures", "page");
  return { success: true };
}

export async function cancelFixture(fixtureId: string, reason: string) {
  const { supabase, user } = await requireUser();

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Say why the fixture is being cancelled." };

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  const { data, error } = await supabase
    .from("fixtures")
    .update({ status: "cancelled", cancellation_reason: trimmedReason })
    .eq("id", fixtureId)
    .in("team_id", teamIds)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Fixture not found or already cancelled." };
  revalidatePath("/dashboard/coach/fixtures", "page");
  revalidatePath(`/dashboard/coach/fixtures/${fixtureId}`, "page");
  return { success: true };
}

/**
 * Permanently remove a fixture — for a data-entry mistake (wrong opponent,
 * duplicate entry, wrong team), not for a real match that's off. Cancel is
 * the right tool for that: it keeps a record and tells parents/players why.
 * Delete has no such record, so a completed fixture (real logged results,
 * ratings, attendance) is never eligible — same boundary updateFixture
 * already draws, for the same reason.
 */
export async function deleteFixture(fixtureId: string) {
  const { supabase, user } = await requireUser();

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  const { data: existing } = await supabase
    .from("fixtures")
    .select("status")
    .eq("id", fixtureId)
    .in("team_id", teamIds)
    .single();

  if (!existing) return { error: "Fixture not found." };
  if (existing.status === "completed") {
    return { error: "This match already has a result logged, so it can't be deleted." };
  }

  const { data, error } = await supabase
    .from("fixtures")
    .delete()
    .eq("id", fixtureId)
    .in("team_id", teamIds)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Fixture not found." };

  revalidatePath("/dashboard/coach/fixtures", "page");
  revalidatePath("/dashboard/parent/fixtures", "page");
  revalidatePath("/dashboard/player/fixtures", "page");
  return { success: true };
}

const logMatchSchema = z.object({
  fixture_id: z.string().uuid(),
  team_score: z.coerce.number().int().min(0).max(30),
  opponent_score: z.coerce.number().int().min(0).max(30),
  match_notes: z.string().max(500).optional(),
  appearances: z.array(z.object({ player_id: z.string().uuid(), played: z.boolean() })),
  ratings: z.array(z.object({
    player_id: z.string().uuid(),
    rating: z.coerce.number().int().min(1).max(5),
    note: z.string().max(200).optional(),
  })),
});

export async function logMatch(payload: unknown) {
  const { supabase, user } = await requireUser();

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  const parsed = logMatchSchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid payload." };

  const { fixture_id, team_score, opponent_score, match_notes, appearances, ratings } = parsed.data;

  const { data, error } = await supabase.rpc("log_match_result", {
    p_fixture_id:     fixture_id,
    p_team_score:     team_score,
    p_opponent_score: opponent_score,
    p_match_notes:    match_notes ?? null,
    p_appearances:    appearances,
    p_ratings:        ratings,
  });

  if (error) return { error: friendlyError(error) };
  if ((data as { error?: string } | null)?.error) return { error: (data as { error: string }).error };

  revalidatePath(`/dashboard/coach/fixtures/${fixture_id}`);
  revalidatePath("/dashboard/coach/fixtures", "page");
  redirect(`/dashboard/coach/fixtures/${fixture_id}`);
}
