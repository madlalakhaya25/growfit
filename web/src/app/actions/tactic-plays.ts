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
  voice_url: string | null;
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
    .select("id, name, notes, team_id, updated_at, concept_ids, session_id, fixture_id, shared, share_token, voice_url")
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
  play?: { name: string; notes: string | null; data: unknown; concept_ids: string[]; voice_url: string | null; team_name: string; age_group: string | null };
  error?: string;
}> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_shared_play", { p_share_token: token });
  if (error) return { error: error.message };
  const res = data as { error?: string } & Record<string, unknown>;
  if (res?.error) return { error: res.error };
  return { play: res as never };
}

/** Attach a recorded voice note to a play. Audio lives in the academy-media bucket. */
export async function uploadPlayVoiceNote(formData: FormData): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireUser();

  const playId = formData.get("play_id") as string;
  const file = formData.get("file") as File | null;
  if (!playId) return { error: "Save the play before recording a voice note." };
  if (!file || !file.size) return { error: "No recording captured." };
  if (file.size > 10 * 1024 * 1024) return { error: "Voice note must be under 10 MB." };
  if (!file.type.startsWith("audio/")) return { error: "Only audio recordings are allowed." };

  // Confirm the caller may write this play, and pick up any previous recording.
  const { data: play } = await supabase
    .from("tactic_plays")
    .select("id, academy_id, voice_path")
    .eq("id", playId)
    .single();
  if (!play) return { error: "Play not found." };

  const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : "webm";
  const path = `${play.academy_id}/voice/${playId}-${Date.now()}.${ext}`;

  const { error: storageErr } = await supabase.storage
    .from("academy-media")
    .upload(path, file, { contentType: file.type });
  if (storageErr) return { error: storageErr.message };

  const { data: { publicUrl } } = supabase.storage.from("academy-media").getPublicUrl(path);

  const { error: updErr } = await supabase
    .from("tactic_plays")
    .update({ voice_url: publicUrl, voice_path: path })
    .eq("id", playId);
  if (updErr) return { error: updErr.message };

  // Only remove the old file once the new one is safely recorded.
  if (play.voice_path) {
    await supabase.storage.from("academy-media").remove([play.voice_path]);
  }

  revalidatePath("/dashboard/coach/tactics/board");
  return { url: publicUrl };
}

export async function deletePlayVoiceNote(playId: string): Promise<{ success?: boolean; error?: string }> {
  const { supabase } = await requireUser();

  const { data: play } = await supabase
    .from("tactic_plays")
    .select("voice_path")
    .eq("id", playId)
    .single();

  const { error } = await supabase
    .from("tactic_plays")
    .update({ voice_url: null, voice_path: null })
    .eq("id", playId);
  if (error) return { error: error.message };

  if (play?.voice_path) {
    await supabase.storage.from("academy-media").remove([play.voice_path]);
  }
  revalidatePath("/dashboard/coach/tactics/board");
  return { success: true };
}

/** Plays a player can see: shared, and belonging to a team they play for. */
export async function listSharedPlaysForMe(): Promise<{
  plays?: { id: string; name: string; notes: string | null; share_token: string; concept_ids: string[]; voice_url: string | null; team_name: string; updated_at: string }[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!player) return { plays: [] };

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", player.id)
    .eq("active", true);

  const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);
  if (teamIds.length === 0) return { plays: [] };

  const { data, error } = await supabase
    .from("tactic_plays")
    .select("id, name, notes, share_token, concept_ids, voice_url, updated_at, teams ( name )")
    .in("team_id", teamIds)
    .eq("shared", true)
    .order("updated_at", { ascending: false });

  if (error) return { error: error.message };

  type Row = {
    id: string; name: string; notes: string | null; share_token: string;
    concept_ids: string[]; voice_url: string | null; updated_at: string;
    teams: { name: string } | { name: string }[] | null;
  };

  return {
    plays: ((data ?? []) as Row[]).map((p) => ({
      id: p.id,
      name: p.name,
      notes: p.notes,
      share_token: p.share_token,
      concept_ids: p.concept_ids ?? [],
      voice_url: p.voice_url,
      updated_at: p.updated_at,
      team_name: (Array.isArray(p.teams) ? p.teams[0]?.name : p.teams?.name) ?? "",
    })),
  };
}
