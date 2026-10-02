import { PLAN_LIMITS, clean, type DevelopmentPlanStructured } from "@/lib/development-plan-schema";

/**
 * A coach editing a draft plan's wording before approving it. Only words can
 * change: which focus areas and actions there are, their categories, the
 * review date and the coach-only fields stay as the model made them. Every
 * string goes through the same cleaning and length limits as the model's own
 * output, so an edit cannot be longer or messier than a generated plan.
 */
export interface PlanEdits {
  playerNote?: string;
  /** One entry per focus area, in order. */
  focusAreas?: { area: string; why: string }[];
  /** One entry per action, in order. */
  actions?: { what: string; how: string; measure: string }[];
}

export type EditResult = { plan: DevelopmentPlanStructured } | { error: string };

export function applyPlanEdits(plan: DevelopmentPlanStructured, edits: PlanEdits): EditResult {
  let playerNote = plan.playerNote;
  if (edits.playerNote !== undefined) {
    playerNote = clean(edits.playerNote, PLAN_LIMITS.playerNote);
    if (!playerNote) return { error: "The note to the player can't be empty." };
  }

  let focusAreas = plan.focusAreas;
  if (edits.focusAreas !== undefined) {
    if (edits.focusAreas.length !== plan.focusAreas.length) return { error: "The focus areas changed. Reload and try again." };
    const next = [];
    for (const [i, f] of plan.focusAreas.entries()) {
      const area = clean(edits.focusAreas[i].area, PLAN_LIMITS.area);
      const why = clean(edits.focusAreas[i].why, PLAN_LIMITS.why);
      if (!area || !why) return { error: "Each focus area needs a name and a reason." };
      next.push({ ...f, area, why });
    }
    focusAreas = next;
  }

  let actions = plan.actions;
  if (edits.actions !== undefined) {
    if (edits.actions.length !== plan.actions.length) return { error: "The actions changed. Reload and try again." };
    const next = [];
    for (const [i, a] of plan.actions.entries()) {
      const what = clean(edits.actions[i].what, PLAN_LIMITS.what);
      const how = clean(edits.actions[i].how, PLAN_LIMITS.how);
      if (!what || !how) return { error: "Each action needs a title and how to do it." };
      next.push({ ...a, what, how, measure: clean(edits.actions[i].measure, PLAN_LIMITS.measure) });
    }
    actions = next;
  }

  return { plan: { ...plan, playerNote, focusAreas, actions } };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export interface PlanChanges {
  added: string[];
  kept: string[];
  dropped: string[];
}

/** What a new draft changes about the focus areas of the plan the family can see now. */
export function planChanges(previousAreas: string[] | null, next: string[]): PlanChanges {
  const before = new Map((previousAreas ?? []).map((a) => [norm(a), a]));
  const after = new Map(next.map((a) => [norm(a), a]));
  return {
    added: [...after].filter(([k]) => !before.has(k)).map(([, v]) => v),
    kept: [...after].filter(([k]) => before.has(k)).map(([, v]) => v),
    dropped: [...before].filter(([k]) => !after.has(k)).map(([, v]) => v),
  };
}
