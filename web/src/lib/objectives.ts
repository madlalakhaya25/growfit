// Match -> Training -> Follow-up (docs/FEATURE_SPECS/match-to-training.md): the
// rules for a team's development objectives. Pure, so Jest can load it and a
// coach can predict every outcome.
//
// An objective is one thing a team works on, taken from a match problem. The
// shape follows Football Australia's "football problem" loop: name the moment
// of the game, say what the objective is, train for it, then ask at the next
// match whether the problem showed up again.

import { MATCH_PHASES, type MatchPhaseId, type PhaseRatings } from "@/lib/match-phases";

/** A team works on at most this many things at once. Also enforced in the database. */
export const MAX_OPEN_OBJECTIVES = 2;

export type ObjectiveVerdict = "improved" | "partly" | "not_yet";
export const OBJECTIVE_VERDICTS: readonly ObjectiveVerdict[] = ["improved", "partly", "not_yet"];

/** The coach's answer to "Did we see the problem again?" */
export type SeenAgain = "no" | "a_bit" | "yes";

const PHASE_IDS = new Set<string>(MATCH_PHASES.map((p) => p.id));

/**
 * "Did we see the problem again?" turned into a verdict. Seeing it again is the
 * bad outcome, so the mapping runs the opposite way round to the answer.
 */
export function verdictFromSeenAgain(answer: SeenAgain): ObjectiveVerdict {
  if (answer === "no") return "improved";
  return answer === "a_bit" ? "partly" : "not_yet";
}

export function verdictLabel(v: ObjectiveVerdict): string {
  switch (v) {
    case "improved": return "Improved";
    case "partly": return "Partly";
    default: return "Not yet";
  }
}

/**
 * The phase of play to suggest working on: the lowest-rated one. Ties go to the
 * earlier phase in the fixed order, so the same ratings always suggest the same
 * thing. Null when nothing is rated, or when every rated phase has the same
 * rating (nothing stands out, so the coach chooses).
 */
export function suggestPhase(ratings: PhaseRatings | null): MatchPhaseId | null {
  if (!ratings) return null;
  const rated = MATCH_PHASES.flatMap((p) => (ratings[p.id] ? [{ id: p.id, rating: ratings[p.id]! }] : []));
  if (rated.length === 0) return null;
  const lowest = rated.reduce((a, b) => (b.rating < a.rating ? b : a), rated[0]);
  if (rated.every((r) => r.rating === lowest.rating)) return null;
  return lowest.id;
}

/** Whether another objective may be opened for the team. */
export function canOpenObjective(openCount: number): boolean {
  return openCount < MAX_OPEN_OBJECTIVES;
}

/** The objective sentence when the coach only typed the problem. */
export function defaultObjectiveText(problem: string): string {
  let p = problem.trim();
  while (p.length > 0 && ".!?".includes(p[p.length - 1])) p = p.slice(0, -1);
  return `Work on: ${p}`.slice(0, 200);
}

export interface ObjectiveDetail {
  where?: string;
  when?: string;
  why?: string;
}

export interface CleanObjectiveInput {
  phase: MatchPhaseId | null;
  problem: string;
  problemKey: string | null;
  objective: string;
  detail: ObjectiveDetail | null;
}

const DETAIL_KEYS = ["where", "when", "why"] as const;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

function cleanObjectiveText(raw: unknown, problem: string): string | null {
  if (raw === undefined || raw === null) return defaultObjectiveText(problem);
  if (typeof raw === "string" && raw.trim() === "") return defaultObjectiveText(problem);
  return text(raw, 200);
}

function cleanDetail(raw: unknown): ObjectiveDetail | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const out: ObjectiveDetail = {};
  for (const key of DETAIL_KEYS) {
    const v = text(d[key], 200);
    if (v) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * What is worth saving from anything sent to the create action: a problem of
 * 1 to 200 characters, a known phase or none, an objective (made from the
 * problem when blank) and the optional where / when / why. Null when there is
 * no usable problem. Over-long text is refused, never silently cut.
 */
export function cleanObjectiveInput(raw: unknown): CleanObjectiveInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const problem = text(r.problem, 200);
  if (!problem) return null;
  const objective = cleanObjectiveText(r.objective, problem);
  if (!objective) return null;

  const phase = typeof r.phase === "string" && PHASE_IDS.has(r.phase) ? (r.phase as MatchPhaseId) : null;
  return { phase, problem, problemKey: text(r.problemKey, 60), objective, detail: cleanDetail(r.detail) };
}

export interface ObjectiveRow {
  id: string;
  status: "open" | "closed";
  /** ISO timestamp the objective was opened. */
  createdAt: string;
  /** The match it came from, when it came from one. */
  sourceFixtureId: string | null;
  verdict: ObjectiveVerdict | null;
  /** Number of sessions and plays linked to it. */
  linkedCount: number;
}

export interface FixtureRow {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** True once the result is logged. */
  played: boolean;
}

export type DebtKind = "no_training_yet" | "no_follow_up";

export interface ObjectiveDebt {
  objectiveId: string;
  kind: DebtKind;
}

/** Whole days from one YYYY-MM-DD to another, never negative. */
function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * Open objectives that need attention. A first, small piece of "development
 * debt": things that were meant to happen and did not, found from data the
 * coach already entered, never from extra admin.
 *
 *   no_training_yet  open for at least `graceDays` and nothing linked to it
 *   no_follow_up     a match was played after it was opened and it still has
 *                    no verdict (the follow-up question was skipped)
 *
 * Closed objectives never appear. `today` is passed in, never read from the clock.
 */
export function objectiveDebt(
  objectives: ObjectiveRow[],
  fixtures: FixtureRow[],
  today: string,
  graceDays = 7,
): ObjectiveDebt[] {
  const out: ObjectiveDebt[] = [];
  for (const o of objectives) {
    if (o.status !== "open") continue;
    const opened = o.createdAt.slice(0, 10);
    const laterMatch = fixtures.some(
      (f) => f.played && f.id !== o.sourceFixtureId && f.date > opened,
    );
    if (laterMatch && o.verdict === null) {
      out.push({ objectiveId: o.id, kind: "no_follow_up" });
    } else if (o.linkedCount === 0 && daysBetween(opened, today) >= graceDays) {
      out.push({ objectiveId: o.id, kind: "no_training_yet" });
    }
  }
  return out;
}
