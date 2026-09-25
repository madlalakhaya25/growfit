"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isTrustedEmbedUrl } from "@/lib/video-embed";
import { friendlyError } from "@/lib/friendly-error";
import { formatDayMonth } from "@/lib/time";
import { tallyOpponentFormations, type FormationTally } from "@/lib/opponent-counter";

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
  /** 'pitch' (the tactical board) or 'film' (a video/still telestration) —
   * see migration 028. Everything else about which kind a play is lives
   * inside its own `data` blob; this column exists purely so the list view
   * can tell them apart without fetching that (potentially large) blob. */
  surface: "pitch" | "film";
}

export interface LinkTarget {
  id: string;
  label: string;
  when: string;
}

/**
 * Confirm the caller coaches this team, and resolve its academy.
 *
 * Not redundant with RLS: `tactic_play_staff_write`/`_update`/`_delete`
 * only check `is_admin_or_coach()` + academy match, not which team a coach
 * specifically coaches, so this app-level filter is the only thing
 * stopping one coach from writing another coach's plays. Audited as part
 * of docs/BACKLOG.md 1.5; don't remove this as "redundant" without
 * re-checking the actual RLS policy first.
 */
async function requireCoachTeam(teamId: string) {
  const { supabase, user } = await requireUser();
  const { data: team } = await supabase
    .from("teams")
    .select("id, academy_id")
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id))
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
  surface?: "pitch" | "film";
}): Promise<{ id?: string; error?: string }> {
  const name = input.name.trim();
  if (!name) return { error: "Give the play a name." };
  if (name.length > 80) return { error: "Name is too long (80 characters max)." };

  const { supabase, user, team } = await requireCoachTeam(input.teamId);
  if (!team) return { error: "You don't coach this team." };

  // `data` is otherwise-unvalidated JSONB rendered back out verbatim —
  // for a film play specifically, embedUrl becomes an <iframe src> shown
  // to whoever opens it (film-board.tsx, film-viewer.tsx), including
  // players/parents via a share link. Strip anything that isn't actually
  // one of the two hosts video-embed.ts's own parser ever produces, rather
  // than trusting the client sent back what it was given.
  let playData = input.data;
  if (input.surface === "film" && playData && typeof playData === "object") {
    const d = playData as Record<string, unknown>;
    if (typeof d.embedUrl === "string" && !isTrustedEmbedUrl(d.embedUrl)) {
      playData = { ...d, embedUrl: undefined, embedProvider: undefined };
    }
  }

  const fields = {
    name,
    notes: input.notes?.trim() || null,
    data: playData,
    concept_ids: input.conceptIds ?? [],
    session_id: input.sessionId || null,
    fixture_id: input.fixtureId || null,
    surface: input.surface ?? "pitch",
  };

  if (input.playId) {
    const { error } = await supabase
      .from("tactic_plays")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", input.playId);
    if (error) return { error: friendlyError(error) };
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

export async function listPlays(teamId: string, surface?: "pitch" | "film"): Promise<{ plays?: SavedPlaySummary[]; error?: string }> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("tactic_plays")
    .select("id, name, notes, team_id, updated_at, concept_ids, session_id, fixture_id, shared, share_token, voice_url, surface")
    .eq("team_id", teamId);
  if (surface) query = query.eq("surface", surface);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) return { error: friendlyError(error) };
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

  const fmt = (d: string) => formatDayMonth(d);

  return {
    sessions: (sessions ?? []).map((s: { id: string; title: string; session_date: string }) => ({
      id: s.id, label: s.title, when: fmt(s.session_date),
    })),
    fixtures: (fixtures ?? []).map((f: { id: string; opponent: string; fixture_date: string }) => ({
      id: f.id, label: `vs ${f.opponent}`, when: fmt(f.fixture_date),
    })),
  };
}

export interface OpponentScouting {
  opponent: string;
  /** Shapes we've set this opponent up in on the board before, most used first. */
  formations: FormationTally[];
  /** Completed meetings, most recent first. */
  results: { when: string; score: string; notes: string | null }[];
}

/**
 * What we already know about the opponent in a fixture: the shapes this
 * team's coaches have set them up in on the board (plays linked to any
 * fixture against the same opponent name) and the logged results against
 * them. Feeds the board's "usually plays…" chip and the AI counter's
 * prompt. Opponent names are matched case-insensitively, the same
 * normalisation squad-context.ts's opponent memory uses.
 */
export async function getOpponentScouting(teamId: string, fixtureId: string): Promise<{ scouting?: OpponentScouting; error?: string }> {
  const { supabase, team } = await requireCoachTeam(teamId);
  if (!team) return { error: "You don't coach this team." };

  const { data: fixture } = await supabase
    .from("fixtures")
    .select("opponent")
    .eq("id", fixtureId)
    .eq("team_id", teamId)
    .single();
  if (!fixture) return { error: "Fixture not found." };
  const opponent = (fixture.opponent as string).trim();

  // ilike with the LIKE wildcards escaped = a case-insensitive exact match.
  const pattern = opponent.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: meetings } = await supabase
    .from("fixtures")
    .select("id, fixture_date, status, match_results ( team_score, opponent_score, match_notes )")
    .eq("team_id", teamId)
    .ilike("opponent", pattern)
    .order("fixture_date", { ascending: false })
    .limit(20);
  const rows = (meetings ?? []) as {
    id: string; fixture_date: string; status: string;
    match_results: { team_score: number; opponent_score: number; match_notes: string | null }[] | { team_score: number; opponent_score: number; match_notes: string | null } | null;
  }[];

  // Only the two keys the tally needs, not whole play blobs.
  const { data: plays } = await supabase
    .from("tactic_plays")
    .select("awayFormationId:data->awayFormationId, tokens:data->tokens")
    .eq("team_id", teamId)
    .eq("surface", "pitch")
    .in("fixture_id", [...new Set([fixtureId, ...rows.map((r) => r.id)])]);

  const results = rows
    .filter((r) => r.status === "completed")
    .slice(0, 5)
    .flatMap((r) => {
      const mr = Array.isArray(r.match_results) ? r.match_results[0] : r.match_results;
      if (!mr) return [];
      return [{ when: formatDayMonth(r.fixture_date), score: `${mr.team_score}-${mr.opponent_score}`, notes: mr.match_notes?.slice(0, 200) ?? null }];
    });

  return {
    scouting: {
      opponent,
      formations: tallyOpponentFormations((plays ?? []) as { awayFormationId?: unknown; tokens?: unknown }[]),
      results,
    },
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
  if (error) return { error: friendlyError(error) };
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

  if (error) return { error: friendlyError(error) };
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
  if (error) return { error: friendlyError(error) };
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
  if (storageErr) return { error: friendlyError(storageErr, "Couldn't upload that voice note.") };

  const { data: { publicUrl } } = supabase.storage.from("academy-media").getPublicUrl(path);

  const { error: updErr } = await supabase
    .from("tactic_plays")
    .update({ voice_url: publicUrl, voice_path: path })
    .eq("id", playId);
  if (updErr) return { error: friendlyError(updErr) };

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
  if (error) return { error: friendlyError(error) };

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

  if (error) return { error: friendlyError(error) };

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
