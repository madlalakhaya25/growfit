"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFixtureSchema } from "@/lib/validation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";

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

  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach/fixtures", "page");
  redirect(`/dashboard/coach/fixtures?team=${teamId}`);
}

export async function cancelFixture(fixtureId: string) {
  const { supabase, user } = await requireUser();

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.length) return { error: "No team found." };

  const { data, error } = await supabase
    .from("fixtures")
    .update({ status: "cancelled" })
    .eq("id", fixtureId)
    .in("team_id", teamIds)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Fixture not found or already cancelled." };
  revalidatePath("/dashboard/coach/fixtures", "page");
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

  if (error) return { error: error.message };
  if ((data as { error?: string } | null)?.error) return { error: (data as { error: string }).error };

  revalidatePath(`/dashboard/coach/fixtures/${fixture_id}`);
  revalidatePath("/dashboard/coach/fixtures", "page");
  redirect(`/dashboard/coach/fixtures/${fixture_id}`);
}
