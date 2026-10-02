import type { DevelopmentAction } from "@/lib/development-plan-schema";
import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** A plan more than this long past its review date is stale; nothing is pushed from it. */
const STALE_AFTER_DAYS = 14;

/** One action from the plan. Not labelled with a focus area: an action carries no link to one, so any pairing would be a guess shown to a child. */
export interface HomeChallenge {
  action: DevelopmentAction;
}

/** Whole weeks since the Monday before the epoch (1970-01-05), in UTC. Stable within a week. */
export function weekNumber(now: Date): number {
  return Math.floor((now.getTime() - Date.UTC(1970, 0, 5)) / WEEK_MS);
}

/**
 * One drill a week, drawn from the player's own APPROVED plan. No model is
 * involved: every word was already read and approved by a coach, so nothing new
 * reaches a child unreviewed. The actions take turns week by week, so a player
 * with three actions sees each in turn and the same one never repeats back to
 * back. Null when the plan has no actions or is well past its review date.
 */
export function pickHomeChallenge(plan: PlayerSafeDevelopmentPlan, now: Date = new Date()): HomeChallenge | null {
  if (plan.actions.length === 0) return null;
  if (plan.reviewDate) {
    const review = new Date(plan.reviewDate).getTime();
    if (Number.isFinite(review) && now.getTime() - review > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) return null;
  }
  return { action: plan.actions[weekNumber(now) % plan.actions.length] };
}
