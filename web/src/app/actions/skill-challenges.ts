"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { getSkillChallenge, isValidScore } from "@/lib/skill-challenges";
import { isMissingSkillChallengeTable, SKILL_CHALLENGES_NOT_YET } from "@/lib/skill-challenges-data";
import { parseDay } from "@/lib/week-plan";
import { todayIso } from "@/lib/time";

/**
 * A coach asks the team (or one player in it) to try a challenge by a date.
 * Only a coach of that team may; a named player must be an active member.
 */
export async function assignSkillChallenge(input: {
  teamId: string;
  challengeKey: string;
  dueOn: string;
  playerId?: string | null;
}) {
  if (!getSkillChallenge(input.challengeKey)) return { error: "Pick a challenge from the list." };
  const dueOn = parseDay(input.dueOn);
  if (!dueOn) return { error: "Pick a due date." };
  if (dueOn < todayIso()) return { error: "The due date has already passed." };

  const { supabase, user } = await requireUser();
  const coached = await getCoachedTeamIds(supabase, user.id);
  if (!coached.includes(input.teamId)) return { error: "You can only set challenges for a team you coach." };

  const { data: team } = await supabase.from("teams").select("id, academy_id").eq("id", input.teamId).single();
  if (!team) return { error: "Team not found." };

  const playerId = input.playerId || null;
  if (playerId) {
    const { data: member } = await supabase
      .from("team_members")
      .select("player_id")
      .eq("team_id", input.teamId)
      .eq("player_id", playerId)
      .eq("active", true)
      .maybeSingle();
    if (!member) return { error: "That player isn't in this team." };
  }

  const { error } = await supabase.from("skill_challenge_assignments").insert({
    academy_id: team.academy_id,
    team_id: input.teamId,
    player_id: playerId,
    challenge_key: input.challengeKey,
    due_on: dueOn,
    created_by: user.id,
  });
  if (error) {
    if (isMissingSkillChallengeTable(error)) return { error: SKILL_CHALLENGES_NOT_YET };
    return { error: friendlyError(error) };
  }
  revalidatePath("/dashboard/coach/training/challenges");
  revalidatePath("/dashboard/player/challenges");
  return { success: true };
}

/** A coach takes a challenge off the list. Scores already logged are kept. */
export async function removeSkillChallengeAssignment(assignmentId: string) {
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase
    .from("skill_challenge_assignments")
    .select("id, team_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!row) return { error: "Challenge not found." };
  const coached = await getCoachedTeamIds(supabase, user.id);
  if (!coached.includes(row.team_id as string)) return { error: "You can only change challenges for a team you coach." };

  const { error } = await supabase.from("skill_challenge_assignments").delete().eq("id", assignmentId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/coach/training/challenges");
  revalidatePath("/dashboard/player/challenges");
  return { success: true };
}

/**
 * Log one score. A player logs their own; a parent may log for a child they
 * are linked to (pass `childId`), the same way they keep the child's medical
 * form. Coaches do not log children's scores.
 */
export async function logSkillChallengeAttempt(challengeKey: string, value: number, childId?: string) {
  const challenge = getSkillChallenge(challengeKey);
  if (!challenge) return { error: "Pick a challenge from the list." };
  if (!isValidScore(challenge, value)) {
    return { error: challenge.unit === "seconds" ? "Enter a time in whole seconds." : "Enter a whole number." };
  }

  const { supabase, user } = await requireUser();
  let playerId: string | null = null;
  if (childId) {
    const { data: link } = await supabase
      .from("parent_player_links")
      .select("player_id")
      .eq("parent_id", user.id)
      .eq("player_id", childId)
      .maybeSingle();
    playerId = (link?.player_id as string | undefined) ?? null;
    if (!playerId) return { error: "You can only log scores for your own child." };
  } else {
    const { data: player } = await supabase.from("players").select("id").eq("profile_id", user.id).maybeSingle();
    playerId = (player?.id as string | undefined) ?? null;
    if (!playerId) return { error: "Only players can log their own scores." };
  }

  const { error } = await supabase.from("skill_challenge_attempts").insert({
    player_id: playerId,
    challenge_key: challengeKey,
    value,
    logged_by: user.id,
  });
  if (error) {
    if (isMissingSkillChallengeTable(error)) return { error: SKILL_CHALLENGES_NOT_YET };
    return { error: friendlyError(error) };
  }
  revalidatePath("/dashboard/player/challenges");
  revalidatePath("/dashboard/player/development");
  if (childId) revalidatePath(`/dashboard/parent/${childId}`);
  return { success: true };
}
