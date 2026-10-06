// Loaders and writers for development objectives (docs/FEATURE_SPECS/match-to-training.md).
// They run through the signed-in user's session, so row security decides who
// may read or write. A database without migration 067 reads as "no objectives"
// and never blocks the match result.

import type { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/friendly-error";
import {
  canOpenObjective, cleanObjectiveInput, objectivesToCheck, phaseChange, verdictFromSeenAgain,
  type FollowUpAnswer, type FollowUpPrompt, type ObjectiveHistoryItem, type ObjectiveVerdict, type OpenObjective,
} from "@/lib/objectives";
import { MATCH_PHASES, cleanPhaseRatings, type MatchPhaseId, type PhaseRatings } from "@/lib/match-phases";

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

const PHASE_IDS = new Set<string>(MATCH_PHASES.map((p) => p.id));
const asPhase = (v: string | null): MatchPhaseId | null => (v && PHASE_IDS.has(v) ? (v as MatchPhaseId) : null);

type ObjectiveRowDb = {
  id: string; subject_id: string; phase: string | null; problem: string; objective: string; created_at: string;
  source_fixture_id: string | null;
  development_objective_links: { link_id: string }[] | null;
};

/**
 * Open objectives for these teams, oldest first, each with how many sessions and
 * plays are linked. Empty when there are none, when the table is missing or when
 * the read fails: the screens that show them are never blocked by this.
 */
export async function loadOpenObjectives(supabase: Supabase, teamIds: string[]): Promise<OpenObjective[]> {
  if (teamIds.length === 0) return [];
  // On an error `data` is null, which reads as none.
  const { data } = await supabase
    .from("development_objectives")
    .select("id, subject_id, phase, problem, objective, created_at, source_fixture_id, development_objective_links ( link_id )")
    .eq("subject_type", "team")
    .in("subject_id", teamIds)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  return ((data ?? []) as ObjectiveRowDb[]).map((r) => ({
    id: r.id,
    teamId: r.subject_id,
    phase: asPhase(r.phase),
    problem: r.problem,
    objective: r.objective,
    createdAt: r.created_at,
    sourceFixtureId: r.source_fixture_id,
    linkedCount: r.development_objective_links?.length ?? 0,
  }));
}

/** Records that a session was planned for an objective. Best effort: a failure never blocks the session. */
export async function linkSessionToObjective(supabase: Supabase, objectiveId: string, sessionId: string): Promise<void> {
  await supabase
    .from("development_objective_links")
    .upsert({ objective_id: objectiveId, link_type: "session", link_id: sessionId });
}

/** The team's phase ratings per match, for the given matches. A missing column or table reads as no ratings. */
async function loadPhaseRatings(supabase: Supabase, fixtureIds: string[]): Promise<Map<string, PhaseRatings | null>> {
  const out = new Map<string, PhaseRatings | null>();
  if (fixtureIds.length === 0) return out;
  const { data } = await supabase.from("match_results").select("fixture_id, phase_ratings").in("fixture_id", fixtureIds);
  for (const r of (data ?? []) as { fixture_id: string; phase_ratings: unknown }[]) {
    out.set(r.fixture_id, cleanPhaseRatings(r.phase_ratings));
  }
  return out;
}

/**
 * What to ask the coach when this match is logged: each open objective that
 * was set before it, with the rating the phase had last time.
 */
export async function loadFollowUpPrompts(
  supabase: Supabase,
  args: { teamId: string; fixtureId: string; fixtureDate: string },
): Promise<FollowUpPrompt[]> {
  const open = objectivesToCheck(await loadOpenObjectives(supabase, [args.teamId]), args.fixtureId, args.fixtureDate);
  if (open.length === 0) return [];
  const ratings = await loadPhaseRatings(supabase, open.flatMap((o) => (o.sourceFixtureId ? [o.sourceFixtureId] : [])));
  return open.map((o) => ({
    id: o.id,
    problem: o.problem,
    objective: o.objective,
    phase: o.phase,
    before: o.phase && o.sourceFixtureId ? (ratings.get(o.sourceFixtureId)?.[o.phase] ?? null) : null,
  }));
}

/**
 * Close the objectives the coach answered about at this match, recording the
 * verdict and the match. Only open objectives of this team are touched.
 * Returns how many could not be saved.
 */
export async function closeObjectivesWithVerdict(
  supabase: Supabase,
  args: { teamId: string; fixtureId: string; answers: FollowUpAnswer[]; now: Date },
): Promise<number> {
  let failed = 0;
  for (const a of args.answers) {
    const { data, error } = await supabase
      .from("development_objectives")
      .update({
        status: "closed",
        verdict: verdictFromSeenAgain(a.answer),
        follow_up_fixture_id: args.fixtureId,
        closed_at: args.now.toISOString(),
      })
      .eq("id", a.objectiveId)
      .eq("subject_type", "team")
      .eq("subject_id", args.teamId)
      .eq("status", "open")
      .select("id");
    if (error || !data?.length) failed += 1;
  }
  return failed;
}

type ClosedRowDb = {
  id: string; phase: string | null; objective: string; verdict: string | null; closed_at: string | null;
  source_fixture_id: string | null; follow_up_fixture_id: string | null;
  development_objective_links: { link_id: string }[] | null;
};

const VERDICTS = new Set<string>(["improved", "partly", "not_yet"]);

/** The team's closed objectives, newest first, each with sessions linked and the phase rating before and after. */
export async function loadClosedObjectives(supabase: Supabase, teamId: string, limit = 10): Promise<ObjectiveHistoryItem[]> {
  const { data } = await supabase
    .from("development_objectives")
    .select("id, phase, objective, verdict, closed_at, source_fixture_id, follow_up_fixture_id, development_objective_links ( link_id )")
    .eq("subject_type", "team")
    .eq("subject_id", teamId)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as ClosedRowDb[];
  if (rows.length === 0) return [];
  const ids = rows.flatMap((r) => [r.source_fixture_id, r.follow_up_fixture_id].filter((x): x is string => Boolean(x)));
  const ratings = await loadPhaseRatings(supabase, [...new Set(ids)]);
  return rows.map((r) => {
    const phase = asPhase(r.phase);
    return {
      id: r.id,
      objective: r.objective,
      phase,
      verdict: r.verdict && VERDICTS.has(r.verdict) ? (r.verdict as ObjectiveVerdict) : null,
      closedAt: r.closed_at,
      linkedCount: r.development_objective_links?.length ?? 0,
      change: phaseChange(
        r.source_fixture_id ? (ratings.get(r.source_fixture_id) ?? null) : null,
        r.follow_up_fixture_id ? (ratings.get(r.follow_up_fixture_id) ?? null) : null,
        phase,
      ),
    };
  });
}
