"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { coachesPlayer, getCoachedTeamIds } from "@/lib/coached-teams";
import { findFlaggedWording } from "@/lib/child-safe-check";
import { FAMILY_BODY_MAX, isMissingFamilyTable } from "@/lib/family-messages";
import { planStoryDrafts, type SquadFact } from "@/lib/match-story";
import { planDigestDrafts, weekKeyFor } from "@/lib/weekly-digest";
import { loadDigestFacts } from "@/lib/weekly-digest-data";
import { todayIso } from "@/lib/time";
import { reportError } from "@/lib/report-error";

const NOT_STAFF = "Only coaches and admins can do this.";
const NOT_YET = "Match stories need a database update that hasn't been run yet. Ask your academy admin to run migration 058.";

type One = { id: string; player_id: string; status: string; body: string; academy_id: string };

/** A message the caller may act on: it exists and they coach the child. */
async function loadOwned(messageId: string) {
  const { supabase, user, profile } = await requireStaff();
  if (!profile) return { error: NOT_STAFF } as const;
  const { data: row, error } = await supabase
    .from("family_messages").select("id, player_id, status, body, academy_id").eq("id", messageId).single();
  if (error && isMissingFamilyTable(error)) return { error: NOT_YET } as const;
  if (!row) return { error: "Message not found." } as const;
  const one = row as One;
  if (!(await coachesPlayer(supabase, { userId: user.id, role: profile.role, playerId: one.player_id }))) {
    return { error: "You don't coach this player." } as const;
  }
  return { supabase, user, row: one } as const;
}

/**
 * Write a draft match story for every child on this match's sheet that has none.
 * Existing messages, edited or approved, are left alone. Nothing here is visible
 * to a family: drafts only.
 */
export async function draftMatchStories(fixtureId: string): Promise<{ created?: number; error?: string }> {
  try {
    const { supabase, user, profile } = await requireStaff();
    if (!profile?.academy_id) return { error: NOT_STAFF };

    // An admin may draft for any match in the academy (RLS keeps it to theirs);
    // a coach only for the teams they coach.
    const base = supabase
      .from("fixtures")
      .select("id, team_id, opponent, is_home, match_results ( team_score, opponent_score ), match_appearances ( played, player_id, players ( full_name ) ), player_ratings ( player_id, rating, note )")
      .eq("id", fixtureId);
    const { data: fixture } = profile.role === "admin"
      ? await base.single()
      : await base.in("team_id", await getCoachedTeamIds(supabase, user.id)).single();
    if (!fixture) return { error: "Match not found or access denied." };

    type Appearance = { played: boolean; player_id: string; players: { full_name: string } | { full_name: string }[] | null };
    type Rating = { player_id: string; rating: number; note: string | null };
    const result = (Array.isArray(fixture.match_results) ? fixture.match_results[0] : fixture.match_results) as
      { team_score: number; opponent_score: number } | null | undefined;
    const ratingsBy = new Map<string, Rating[]>();
    for (const r of (fixture.player_ratings ?? []) as Rating[]) ratingsBy.set(r.player_id, [...(ratingsBy.get(r.player_id) ?? []), r]);

    const squad: SquadFact[] = ((fixture.match_appearances ?? []) as Appearance[]).map((a) => {
      const p = Array.isArray(a.players) ? a.players[0] : a.players;
      return {
        playerId: a.player_id, fullName: p?.full_name ?? "", played: a.played,
        ratings: (ratingsBy.get(a.player_id) ?? []).map((r) => ({ rating: r.rating, note: r.note })),
      };
    });
    if (squad.length === 0) return { error: "Log the match and who played first." };

    const { data: existing, error: existingError } = await supabase
      .from("family_messages").select("player_id").eq("kind", "match_story").eq("ref_key", fixtureId);
    if (existingError) return { error: isMissingFamilyTable(existingError) ? NOT_YET : "Couldn't read the stories. Try again." };
    const have = new Set(((existing ?? []) as { player_id: string }[]).map((r) => r.player_id));

    const drafts = planStoryDrafts(
      { opponent: fixture.opponent as string, isHome: (fixture.is_home as boolean | null) ?? null, teamScore: result?.team_score ?? null, opponentScore: result?.opponent_score ?? null },
      squad,
      have,
    );
    if (drafts.length === 0) return { created: 0 };

    const { error } = await supabase.from("family_messages").insert(
      drafts.map((d) => ({
        academy_id: profile.academy_id, player_id: d.playerId, kind: "match_story", ref_key: fixtureId,
        body: d.body, status: "draft", created_by: user.id,
      })),
    );
    if (error) return { error: isMissingFamilyTable(error) ? NOT_YET : "Couldn't save the stories. Try again." };
    revalidatePath(`/dashboard/coach/fixtures/${fixtureId}`);
    return { created: drafts.length };
  } catch (err) {
    reportError(err, { scope: "draftMatchStories" });
    return { error: "Couldn't write the stories. Try again." };
  }
}

/**
 * Write this week's note for every child on a team who has something kind and
 * true to be told and no note yet. Drafts only: a family sees nothing until a
 * coach shares each one. A coach may only write for a team they coach.
 */
export async function draftWeeklyDigests(teamId: string): Promise<{ created?: number; error?: string }> {
  try {
    const { supabase, user, profile } = await requireStaff();
    if (!profile?.academy_id) return { error: NOT_STAFF };
    if (profile.role !== "admin" && !(await getCoachedTeamIds(supabase, user.id)).includes(teamId)) {
      return { error: "You don't coach this team." };
    }
    const now = new Date();
    const weekKey = weekKeyFor(todayIso(now));
    const facts = await loadDigestFacts(supabase, teamId, weekKey, now);
    if (facts.length === 0) return { error: "This team has no players yet." };

    const { data: existing, error: existingError } = await supabase
      .from("family_messages").select("player_id").eq("kind", "weekly_digest").eq("ref_key", weekKey).in("player_id", facts.map((f) => f.playerId));
    if (existingError) return { error: isMissingFamilyTable(existingError) ? NOT_YET : "Couldn't read the notes. Try again." };
    const have = new Set(((existing ?? []) as { player_id: string }[]).map((r) => r.player_id));

    const drafts = planDigestDrafts(facts, have);
    if (drafts.length === 0) return { created: 0 };
    const { error } = await supabase.from("family_messages").insert(
      drafts.map((d) => ({
        academy_id: profile.academy_id, player_id: d.playerId, kind: "weekly_digest", ref_key: weekKey,
        body: d.body, status: "draft", created_by: user.id,
      })),
    );
    if (error) return { error: isMissingFamilyTable(error) ? NOT_YET : "Couldn't save the notes. Try again." };
    revalidatePath("/dashboard/coach/squad/digest");
    return { created: drafts.length };
  } catch (err) {
    reportError(err, { scope: "draftWeeklyDigests" });
    return { error: "Couldn't write the notes. Try again." };
  }
}

/** A coach edits the words of a draft. An approved message is not edited in place: retract it first. */
export async function saveFamilyMessage(messageId: string, body: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const text = body.trim();
    if (!text) return { error: "Write something first." };
    if (text.length > FAMILY_BODY_MAX) return { error: "That's a bit long. Keep it to a short paragraph." };
    const loaded = await loadOwned(messageId);
    if ("error" in loaded) return { error: loaded.error };
    if (loaded.row.status === "approved") return { error: "This is already shared. Take it back to edit it." };
    const { error } = await loaded.supabase.from("family_messages").update({ body: text }).eq("id", messageId).eq("status", "draft");
    if (error) return { error: "Couldn't save your changes. Try again." };
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "saveFamilyMessage" });
    return { error: "Couldn't save your changes. Try again." };
  }
}

/**
 * Share a draft with the child and their family. The wording check is a last
 * look, not a verdict: a coach who has read what it flagged can approve anyway.
 */
export async function approveFamilyMessage(
  messageId: string,
  options?: { acknowledgeWording?: boolean },
): Promise<{ success?: boolean; flagged?: boolean; error?: string }> {
  try {
    const loaded = await loadOwned(messageId);
    if ("error" in loaded) return { error: loaded.error };
    const { supabase, user, row } = loaded;
    if (row.status === "approved") return { success: true };

    const flags = findFlaggedWording(row.body);
    if (flags.length > 0 && !options?.acknowledgeWording) {
      return { flagged: true, error: `Some of the wording may read as negative to a child (${flags.join(", ")}). Edit it, or approve it as it is.` };
    }
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const { error } = await supabase
      .from("family_messages")
      .update({
        status: "approved", approved_by: user.id,
        approved_by_name: (me?.full_name as string | undefined) ?? "A coach",
        approved_at: new Date().toISOString(),
      })
      .eq("id", messageId);
    if (error) return { error: "Couldn't share it. Try again." };
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "approveFamilyMessage" });
    return { error: "Couldn't share it. Try again." };
  }
}

/** Take a shared message back to draft: the family stops seeing it at once. */
export async function retractFamilyMessage(messageId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const loaded = await loadOwned(messageId);
    if ("error" in loaded) return { error: loaded.error };
    const { error } = await loaded.supabase
      .from("family_messages")
      .update({ status: "draft", approved_by: null, approved_by_name: null, approved_at: null })
      .eq("id", messageId);
    if (error) return { error: "Couldn't take it back. Try again." };
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "retractFamilyMessage" });
    return { error: "Couldn't take it back. Try again." };
  }
}
