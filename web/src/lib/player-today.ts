// What a player's Today page picks out (docs/AI_AND_UX_PLAN_2026.md section 6):
// the homework due, a challenge to beat and the latest medal. Pure, and only ever
// about the player's own results: no comparison with a teammate.

import { TROPHY_LABELS, nextTarget, type ChallengeResult, type SkillAgeBand, type Trophy } from "@/lib/skill-challenges";

export interface HomeworkLike {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
}

/** The open homework due soonest (YYYY-MM-DD dates), or null. */
export function homeworkDue<T extends HomeworkLike>(items: readonly T[]): T | null {
  let soonest: T | null = null;
  for (const i of items) {
    if (!i.done && (soonest === null || i.dueDate < soonest.dueDate)) soonest = i;
  }
  return soonest;
}

export interface ChallengeToBeat {
  key: string;
  name: string;
  dueOn: string;
  best: number | null;
  next: { trophy: Trophy; target: number } | null;
}

/** The first assigned challenge (the list is already soonest due first), with the score to aim for. */
export function challengeToBeat(
  assigned: readonly { challenge: ChallengeResult["challenge"]; dueOn: string; result: ChallengeResult }[],
  band: SkillAgeBand,
): ChallengeToBeat | null {
  const first = assigned[0];
  if (!first) return null;
  return {
    key: first.challenge.key,
    name: first.challenge.name,
    dueOn: first.dueOn,
    best: first.result.best,
    next: nextTarget(first.challenge, band, first.result.best),
  };
}

/** The trophy won most recently, by the day of the last attempt, or null. */
export function latestMedal(cabinet: readonly ChallengeResult[]): ChallengeResult | null {
  let latest: ChallengeResult | null = null;
  for (const r of cabinet) {
    if (r.trophy === null || r.lastLoggedAt === null) continue;
    if (!latest || r.lastLoggedAt > (latest.lastLoggedAt ?? "")) latest = r;
  }
  return latest;
}

/** "Beat 12 for Silver (your best: 9)", or the gold line once it is won. */
export function challengeSubtitle(c: Pick<ChallengeToBeat, "best" | "next">): string {
  if (!c.next) return `Gold won, best ${c.best}`;
  const label = `Beat ${c.next.target} for ${TROPHY_LABELS[c.next.trophy]}`;
  return c.best === null ? label : `${label} (your best: ${c.best})`;
}

/** "3 weeks in a row", or undefined when there is no streak. */
export function streakLabel(weeks: number): string | undefined {
  if (weeks <= 0) return undefined;
  return `${weeks} ${weeks === 1 ? "week" : "weeks"} in a row`;
}
