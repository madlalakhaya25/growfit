"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export interface SavedPlaySummary {
  id: string;
  name: string;
  notes: string | null;
  team_id: string;
  updated_at: string;
}

/** Confirm the caller coaches this team, and resolve its academy. */
async function requireCoachTeam(teamId: string) {
  const { supabase, user } = await requireUser();
  const { data: team } = await supabase
    .from("teams")
    .select("id, academy_id")
    .eq("id", teamId)
    .eq("coach_id", user.id)
    .eq("active", true)
    .single();
  return { supabase, user, team };
}

export async function savePlay(input: {
  playId?: string;
  teamId: string;
  name: string;
  notes?: string;
  data: unknown;
}): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Give the play a name." };
  if (name.length > 80) return { error: "Name is too long (80 characters max)." };

  const { supabase, user, team } = await requireCoachTeam(input.teamId);
  if (!team) return { error: "You don't coach this team." };

  if (input.playId) {
    const { error } = await supabase
      .from("tactic_plays")
      .update({ name, notes: input.notes?.trim() || null, data: input.data, updated_at: new Date().toISOString() })
      .eq("id", input.playId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/coach/tactics/board");
    return { id: input.playId };
  }

  const { data, error } = await supabase
    .from("tactic_plays")
    .insert({
      academy_id: team.academy_id,
      team_id: team.id,
      coach_id: user.id,
      name,
      notes: input.notes?.trim() || null,
      data: input.data,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not save the play." };
  revalidatePath("/dashboard/coach/tactics/board");
  return { id: data.id };
}

export async function listPlays(teamId: string): Promise<{ plays?: SavedPlaySummary[]; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tactic_plays")
    .select("id, name, notes, team_id, updated_at")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });
  if (error) return { error: error.message };
  return { plays: (data ?? []) as SavedPlaySummary[] };
}

export async function loadPlay(playId: string): Promise<{ data?: unknown; name?: string; notes?: string | null; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tactic_plays")
    .select("name, notes, data")
    .eq("id", playId)
    .single();
  if (error || !data) return { error: error?.message ?? "Play not found." };
  return { data: data.data, name: data.name, notes: data.notes };
}

export async function deletePlay(playId: string): Promise<{ success?: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tactic_plays").delete().eq("id", playId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach/tactics/board");
  return { success: true };
}

/** Post a play to the squad as an announcement so players/parents see it. */
export async function sharePlayToSquad(input: {
  teamId: string;
  playName: string;
  message?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const { supabase, user, team } = await requireCoachTeam(input.teamId);
  if (!team) return { error: "You don't coach this team." };

  const body = (input.message?.trim() || `Have a look at our "${input.playName}" plan before the next session.`).slice(0, 500);

  const { error } = await supabase.from("announcements").insert({
    team_id: team.id,
    coach_id: user.id,
    title: `Tactics: ${input.playName}`.slice(0, 120),
    body,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach/announcements");
  return { success: true };
}
