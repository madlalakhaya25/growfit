// Loaders and writers for development objectives (docs/FEATURE_SPECS/match-to-training.md).
// They run through the signed-in user's session, so row security decides who
// may read or write. A database without migration 067 reads as "no objectives"
// and never blocks the match result.

import type { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import { canOpenObjective, cleanObjectiveInput } from "@/lib/objectives";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** True when migration 067 has not been run (PostgREST PGRST205, Postgres 42P01). */
export function isMissingObjectivesTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** How many objectives the team has open. Zero when the table is missing. */
export async function countOpenObjectives(supabase: Supabase, teamId: string): Promise<number> {
  const { count, error } = await supabase
    .from("development_objectives")
    .select("id", { count: "exact", head: true })
    .eq("subject_type", "team")
    .eq("subject_id", teamId)
    .eq("status", "open");
  if (error) return 0;
  return count ?? 0;
}

export type CreateObjectiveResult = { created: true } | { created: false; note?: string };

/**
 * Open an objective for a team from a match. Best effort for the match log: it
 * returns a note for the coach rather than failing, because the result is
 * already saved. `raw` is whatever the client sent and is cleaned here.
 */
export async function createMatchObjective(
  supabase: Supabase,
  args: { userId: string; teamId: string; fixtureId: string; raw: unknown },
): Promise<CreateObjectiveResult> {
  const input = cleanObjectiveInput(args.raw);
  if (!input) return { created: false, note: "The focus wasn't saved: say what the problem was in 200 characters or fewer." };

  const { data: team } = await supabase.from("teams").select("academy_id").eq("id", args.teamId).single();
  if (!team) return { created: false, note: "The focus wasn't saved: team not found." };

  const { count, error: countError } = await supabase
    .from("development_objectives")
    .select("id", { count: "exact", head: true })
    .eq("subject_type", "team")
    .eq("subject_id", args.teamId)
    .eq("status", "open");
  if (isMissingObjectivesTable(countError)) return { created: false };
  if (!canOpenObjective(count ?? 0)) {
    return { created: false, note: "The focus wasn't saved: this team already has two open. Close one first." };
  }

  const { error } = await supabase.from("development_objectives").insert({
    academy_id: (team as { academy_id: string }).academy_id,
    subject_type: "team",
    subject_id: args.teamId,
    source_type: "match",
    source_fixture_id: args.fixtureId,
    phase: input.phase,
    problem: input.problem,
    problem_key: input.problemKey,
    detail: input.detail,
    objective: input.objective,
    created_by: args.userId,
  });
  if (isMissingObjectivesTable(error)) return { created: false };
  if (error) return { created: false, note: `The focus wasn't saved: ${friendlyError(error)}` };
  return { created: true };
}
