import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SKILL_CHALLENGES,
  assignedForPlayer,
  resultFor,
  skillAgeBand,
  trophyCabinet,
  weeklyStreak,
  type AssignedChallenge,
  type AttemptRow,
  type ChallengeAssignment,
  type ChallengeResult,
  type SkillAgeBand,
} from "@/lib/skill-challenges";

// Reads for the skill challenges (migration 064). Until that migration is run
// every read comes back `available: false` rather than an error, and the pages
// show a "not set up yet" line instead of crashing.

// The Supabase client is generated without database types in this project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

export const SKILL_CHALLENGES_NOT_YET =
  "Skill challenges need a database update that hasn't been run yet. Ask your academy admin to run migration 064.";

/** PostgREST / Postgres codes for "that table does not exist (yet)". */
export function isMissingSkillChallengeTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export interface AssignmentRow extends ChallengeAssignment {
  team_id: string;
}

export async function loadAssignments(
  supabase: Client,
  teamIds: readonly string[]
): Promise<{ available: boolean; rows: AssignmentRow[] }> {
  if (teamIds.length === 0) return { available: true, rows: [] };
  const { data, error } = await supabase
    .from("skill_challenge_assignments")
    .select("id, team_id, player_id, challenge_key, due_on")
    .in("team_id", teamIds as string[])
    .order("due_on", { ascending: false });
  if (error) return { available: !isMissingSkillChallengeTable(error), rows: [] };
  return { available: true, rows: (data ?? []) as AssignmentRow[] };
}

export async function loadAttempts(
  supabase: Client,
  playerIds: readonly string[]
): Promise<{ available: boolean; rows: AttemptRow[] }> {
  if (playerIds.length === 0) return { available: true, rows: [] };
  const { data, error } = await supabase
    .from("skill_challenge_attempts")
    .select("player_id, challenge_key, value, logged_at")
    .in("player_id", playerIds as string[])
    .order("logged_at", { ascending: false })
    .limit(2000);
  if (error) return { available: !isMissingSkillChallengeTable(error), rows: [] };
  return { available: true, rows: (data ?? []) as AttemptRow[] };
}

/** A player's active teams with their age groups (the first sets the trophy targets). */
export async function loadPlayerTeams(
  supabase: Client,
  playerId: string
): Promise<{ id: string; age_group: string | null }[]> {
  const { data } = await supabase
    .from("team_members")
    .select("team_id, teams ( age_group )")
    .eq("player_id", playerId)
    .eq("active", true);
  type Row = { team_id: string; teams: { age_group: string | null } | { age_group: string | null }[] | null };
  return ((data ?? []) as Row[]).map((r) => {
    const t = Array.isArray(r.teams) ? r.teams[0] : r.teams;
    return { id: r.team_id, age_group: t?.age_group ?? null };
  });
}

export interface ChallengeBoard {
  available: boolean;
  band: SkillAgeBand;
  assigned: (AssignedChallenge & { result: ChallengeResult })[];
  /** Everything else in the catalogue, for practice. */
  others: ChallengeResult[];
  cabinet: ChallengeResult[];
  streak: number;
}

/** Everything one child's Challenges screen (or their parent's view) needs. */
export async function loadChallengeBoard(supabase: Client, playerId: string, today: string): Promise<ChallengeBoard> {
  const teams = await loadPlayerTeams(supabase, playerId);
  const band = skillAgeBand(teams[0]?.age_group ?? null);
  const [assignments, attempts] = await Promise.all([
    loadAssignments(supabase, teams.map((t) => t.id)),
    loadAttempts(supabase, [playerId]),
  ]);
  const assigned = assignedForPlayer(assignments.rows, playerId).map((a) => ({
    ...a,
    result: resultFor(a.challenge, band, attempts.rows),
  }));
  const assignedKeys = new Set(assigned.map((a) => a.challenge.key));
  return {
    available: assignments.available && attempts.available,
    band,
    assigned,
    others: SKILL_CHALLENGES.filter((c) => !assignedKeys.has(c.key)).map((c) => resultFor(c, band, attempts.rows)),
    cabinet: trophyCabinet(band, attempts.rows),
    streak: weeklyStreak(attempts.rows.map((r) => r.logged_at), today),
  };
}
