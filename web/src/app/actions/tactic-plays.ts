"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export interface SavedPlaySummary {
  id: string;
  name: string;
  notes: string | null;
  team_id: string;
  updated_at: string;
  concept_ids: string[];
  session_id: string | null;
  fixture_id: string | null;
  shared: boolean;
  share_token: string | null;
}

export interface LinkTarget {
  id: string;
  label: string;
  when: string;
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
  conceptIds?: string[];
  sessionId?: string | null;
  fixtureId?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Give the play a name." };
  if (name.length > 80) return { error: "Name is too long (80 characters max)." };

  const { supabase, user, team } = await requireCoachTeam(input.teamId);
  if (!team) return { error: "You don't coach this team." };

  const fields = {
    name,
    notes: input.notes?.trim() || null,
    data: input.data,
    concept_ids: input.conceptIds ?? [],
    session_id: input.sessionId || null,
    fixture_id: input.fixtureId || null,
  };

  if (input.playId) {
    const { error } = await supabase
      .from("tactic_plays")
      .update({ ...fields, updated_at: new Date().toISOString() })
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
      ...fields,
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
    .select("id, name, notes, team_id, updated_at, concept_ids, session_id, fixture_id, shared, share_token")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });
  if (error) return { error: error.message };
  return { plays: (data ?? []) as SavedPlaySummary[] };
}

/** Upcoming sessions and fixtures a play can be attached to. */
export async function listLinkTargets(teamId: string): Promise<{ sessions: LinkTarget[]; fixtures: LinkTarget[] }> {
  const { supabase } = await requireUser();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [{ data: sessions }, { data: fixtures }] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, title, session_date")
      .eq("team_id", teamId)
      .gte("session_date", since)
      .order("session_date", { ascending: true })
      .limit(25),
    supabase
      .from("fixtures")
      .select("id, opponent, fixture_date")
      .eq("team_id", teamId)
      .gte("fixture_date", since)
      .order("fixture_date", { ascending: true })
      .limit(25),
  ]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

  return {
    sessions: (sessions ?? []).map((s: { id: string; title: string; session_date: string }) => ({
      id: s.id, label: s.title, when: fmt(s.session_date),
    })),
    fixtures: (fixtures ?? []).map((f: { id: string; opponent: string; fixture_date: string }) => ({
      id: f.id, label: `vs ${f.opponent}`, when: fmt(f.fixture_date),
    })),
  };
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
  playId?: string;
  playName: string;
  message?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const { supabase, user, team } = await requireCoachTeam(input.teamId);
  if (!team) return { error: "You don't coach this team." };
  if (!input.playId) return { error: "Save the play before sharing it." };

  // Mark it shared so players can open it, and get the token for the link.
  const { data: play, error: shareErr } = await supabase
    .from("tactic_plays")
    .update({ shared: true })
    .eq("id", input.playId)
    .select("share_token")
    .single();

  if (shareErr || !play?.share_token) {
    return { error: shareErr?.message ?? "Could not share the play." };
  }

  const link = `/dashboard/player/tactics/${play.share_token}`;
  const body = (
    input.message?.trim() ||
    `Have a look at our "${input.playName}" plan before the next session. Open it here: ${link}`
  ).slice(0, 500);

  const { error } = await supabase.from("announcements").insert({
    team_id: team.id,
    coach_id: user.id,
    title: `Tactics: ${input.playName}`.slice(0, 120),
    body,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach/announcements");
  revalidatePath("/dashboard/coach/tactics/board");
  return { success: true };
}

/** Read a shared play by token for the player-facing view. */
export async function getSharedPlay(token: string): Promise<{
  play?: { name: string; notes: string | null; data: unknown; concept_ids: string[]; team_name: string; age_group: string | null };
  error?: string;
}> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_shared_play", { p_share_token: token });
  if (error) return { error: error.message };
  const res = data as { error?: string } & Record<string, unknown>;
  if (res?.error) return { error: res.error };
  return { play: res as never };
}
