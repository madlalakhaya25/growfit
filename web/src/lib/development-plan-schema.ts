// The shape of an AI development plan, and the validator that decides how much
// of a model's reply is trusted. Pure and free of @google/genai, so Jest can
// load it (the SDK's ESM build can't be loaded there) -- same split as
// opponent-counter.ts. The Gemini responseSchema itself lives in the "use
// server" action, next to the SDK import.

import { categoryMeta, type MilestoneCategory } from "@/lib/development-categories";

export interface DevelopmentFocusArea {
  category: MilestoneCategory;
  area: string;
  why: string;
}

export interface DevelopmentAction {
  what: string;
  how: string;
  timesPerWeek: number;
  measure: string;
  /**
   * Links the action to a real open milestone when one matches, so the plan is
   * actionable against the academy's own pathway, not free-floating. Only ever
   * an id from the brief -- anything else is dropped by the validator.
   */
  milestoneTemplateId: string | null;
}

export type PlanVerdict = "worked" | "partly" | "not_yet" | "no_previous_plan";
export const PLAN_VERDICTS: readonly PlanVerdict[] = ["worked", "partly", "not_yet", "no_previous_plan"];

export interface PreviousPlanVerdict {
  verdict: PlanVerdict;
  /** Coach-only: cites real completions / ratings. */
  evidence: string;
  carriedForward: string[];
}

export interface DevelopmentPlanStructured {
  playerSummary: string;
  focusAreas: DevelopmentFocusArea[]; // 1-3
  actions: DevelopmentAction[]; // 1-4
  /** ISO yyyy-mm-dd. Set by the server, never by the model. */
  reviewDate: string;
  /** Coach-only. */
  previous: PreviousPlanVerdict;
  /** Coach-only; may name a concern. */
  coachNote: string;
  /** Player/parent-safe; never negative. */
  playerNote: string;
}

export const PLAN_LIMITS = {
  focusAreas: 3,
  actions: 4,
  carriedForward: 3,
  summary: 400,
  area: 80,
  why: 240,
  what: 160,
  how: 300,
  measure: 160,
  evidence: 500,
  note: 400,
  playerNote: 300,
} as const;

/** One line, no markdown, bounded. The prompts forbid asterisks; this enforces it. */
export function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Turn a parsed model reply into a plan, or null when it isn't usable.
 *
 * The discipline is `validateCounter`'s: the model's output is untrusted. An
 * unknown category, an id that isn't one of the open milestones, an
 * out-of-range number or an over-long string never reaches storage or a
 * screen; an array is capped. `reviewDate` is supplied by the caller -- a model
 * asked for a date will confidently invent one. `previous` is only taken from
 * the model when a previous plan actually existed to judge.
 */
export function normaliseDevelopmentPlan(
  raw: Record<string, unknown> | null,
  ctx: { openMilestoneIds: ReadonlySet<string>; hasPrevious: boolean; reviewDate: string }
): DevelopmentPlanStructured | null {
  if (!raw) return null;

  const playerSummary = clean(raw.playerSummary, PLAN_LIMITS.summary);
  const playerNote = clean(raw.playerNote, PLAN_LIMITS.playerNote);
  if (!playerSummary || !playerNote) return null;

  const focusAreas: DevelopmentFocusArea[] = [];
  for (const item of Array.isArray(raw.focusAreas) ? raw.focusAreas : []) {
    if (!isRecord(item)) continue;
    const meta = categoryMeta(typeof item.category === "string" ? item.category : null);
    const area = clean(item.area, PLAN_LIMITS.area);
    const why = clean(item.why, PLAN_LIMITS.why);
    if (!meta || !area || !why) continue;
    focusAreas.push({ category: meta.key, area, why });
    if (focusAreas.length === PLAN_LIMITS.focusAreas) break;
  }

  const actions: DevelopmentAction[] = [];
  for (const item of Array.isArray(raw.actions) ? raw.actions : []) {
    if (!isRecord(item)) continue;
    const what = clean(item.what, PLAN_LIMITS.what);
    const how = clean(item.how, PLAN_LIMITS.how);
    if (!what || !how) continue;
    const n = typeof item.timesPerWeek === "number" ? Math.round(item.timesPerWeek) : NaN;
    const id = typeof item.milestoneTemplateId === "string" ? item.milestoneTemplateId.trim() : "";
    actions.push({
      what,
      how,
      timesPerWeek: Number.isFinite(n) ? Math.min(7, Math.max(1, n)) : 2,
      measure: clean(item.measure, PLAN_LIMITS.measure),
      milestoneTemplateId: id && ctx.openMilestoneIds.has(id) ? id : null,
    });
    if (actions.length === PLAN_LIMITS.actions) break;
  }

  if (focusAreas.length === 0 || actions.length === 0) return null;

  let previous: PreviousPlanVerdict = { verdict: "no_previous_plan", evidence: "", carriedForward: [] };
  if (ctx.hasPrevious && isRecord(raw.previous)) {
    const p = raw.previous;
    const v = typeof p.verdict === "string" ? PLAN_VERDICTS.find((x) => x === p.verdict) : undefined;
    // A verdict the model made up isn't a verdict: report "no judgement" rather
    // than guessing which of worked / partly / not_yet it meant.
    if (v && v !== "no_previous_plan") {
      previous = {
        verdict: v,
        evidence: clean(p.evidence, PLAN_LIMITS.evidence),
        carriedForward: (Array.isArray(p.carriedForward) ? p.carriedForward : [])
          .map((x) => clean(x, 120))
          .filter(Boolean)
          .slice(0, PLAN_LIMITS.carriedForward),
      };
    }
  }

  return {
    playerSummary,
    focusAreas,
    actions,
    reviewDate: ctx.reviewDate,
    previous,
    coachNote: clean(raw.coachNote, PLAN_LIMITS.note),
    playerNote,
  };
}
