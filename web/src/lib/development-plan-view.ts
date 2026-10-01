import type {
  DevelopmentAction,
  DevelopmentFocusArea,
  DevelopmentPlanStructured,
} from "@/lib/development-plan-schema";
import { categoryMeta } from "@/lib/development-categories";

/**
 * The player/parent projection of a plan. Deliberately a DIFFERENT type, not a
 * Partial<> of the full one -- so the compiler, not a reviewer, catches a
 * coach-only field (`coachNote`, `previous`) reaching a player surface.
 */
export interface PlayerSafeDevelopmentPlan {
  focusAreas: DevelopmentFocusArea[];
  actions: DevelopmentAction[];
  reviewDate: string;
  playerNote: string;
}

/**
 * Applied SERVER-SIDE before the data crosses to a player or parent page --
 * filtering in a client component would still ship `coachNote` in the RSC
 * payload. The 'development_plan_shared' row stores exactly this, and migration
 * 045's RLS lets a player or parent read only that row.
 *
 * Built field by field (never `{ ...plan }` minus some keys), so a field added
 * to DevelopmentPlanStructured later is private until someone deliberately
 * lists it here.
 */
export function toPlayerSafePlan(s: DevelopmentPlanStructured): PlayerSafeDevelopmentPlan {
  return {
    focusAreas: s.focusAreas.map((f) => ({ category: f.category, area: f.area, why: f.why })),
    actions: s.actions.map((a) => ({
      what: a.what,
      how: a.how,
      timesPerWeek: a.timesPerWeek,
      measure: a.measure,
      milestoneTemplateId: a.milestoneTemplateId,
    })),
    reviewDate: s.reviewDate,
    playerNote: s.playerNote,
  };
}

const VERDICT_TEXT = {
  worked: "It worked.",
  partly: "It partly worked.",
  not_yet: "It hasn't worked yet.",
  no_previous_plan: "",
} as const;

function focusLines(areas: DevelopmentFocusArea[]): string[] {
  return areas.map((f) => `- ${categoryMeta(f.category)?.label ?? f.category}: ${f.area} — ${f.why}`);
}

function actionLines(actions: DevelopmentAction[]): string[] {
  return actions.map((a) => {
    const times = `${a.timesPerWeek}x a week`;
    return `- ${a.what} (${times}). ${a.how}${a.measure ? ` Measure: ${a.measure}` : ""}`;
  });
}

/**
 * Prose for the coach, in the label/bullet shape AiProse recognises
 * ("LABEL:" lines and "- " bullets), rendered from the structured data by a
 * plain template -- no second model call.
 */
export function renderDevelopmentPlanProse(s: DevelopmentPlanStructured): string {
  const lines: string[] = [];
  lines.push(`PLAYER SUMMARY: ${s.playerSummary}`);
  lines.push("");
  lines.push("FOCUS AREAS:", ...focusLines(s.focusAreas));
  lines.push("");
  lines.push("ACTIONS:", ...actionLines(s.actions));
  lines.push("");
  lines.push(`REVIEW DATE: ${s.reviewDate}`);
  if (s.previous.verdict !== "no_previous_plan") {
    lines.push("");
    lines.push(`LAST PLAN: ${VERDICT_TEXT[s.previous.verdict]} ${s.previous.evidence}`.trim());
    if (s.previous.carriedForward.length) {
      lines.push("CARRIED FORWARD:", ...s.previous.carriedForward.map((c) => `- ${c}`));
    }
  }
  if (s.coachNote) {
    lines.push("");
    lines.push(`COACH NOTE: ${s.coachNote}`);
  }
  lines.push("");
  lines.push(`FOR THE PLAYER: ${s.playerNote}`);
  return lines.join("\n");
}

/** Prose for a player or parent. Takes the projection, never the full plan. */
export function renderPlayerPlanProse(s: PlayerSafeDevelopmentPlan): string {
  const lines: string[] = [];
  lines.push(`YOUR FOCUS: ${s.playerNote}`);
  lines.push("");
  lines.push("WHAT TO WORK ON:", ...focusLines(s.focusAreas));
  lines.push("");
  lines.push("HOW:", ...actionLines(s.actions));
  lines.push("");
  lines.push(`REVIEW DATE: ${s.reviewDate}`);
  return lines.join("\n");
}
