// What a parent's Today page says about one child (docs/AI_AND_UX_PLAN_2026.md
// section 6): the next thing they have to turn up for, and the forms still open.
// Pure, so the same data always gives the same page.

import { DOCUMENTS, isDocComplete } from "@/lib/document-definitions";

export interface TodayEvent {
  kind: "match" | "training";
  teamId: string;
  title: string;
  /** ISO kick-off or session start. */
  at: string;
  place: string | null;
  /** A cancelled fixture is never "next". */
  cancelled?: boolean;
}

/** The earliest event not yet started for the given teams, or null. */
export function nextEventFor(events: readonly TodayEvent[], teamIds: ReadonlySet<string>, now: Date): TodayEvent | null {
  let best: TodayEvent | null = null;
  for (const e of events) {
    if (e.cancelled || !teamIds.has(e.teamId)) continue;
    const t = new Date(e.at).getTime();
    if (Number.isNaN(t) || t < now.getTime()) continue;
    if (!best || t < new Date(best.at).getTime()) best = e;
  }
  return best;
}

/** Labels of the registration documents this child still needs, in the usual order. */
export function formsToSign(docStatus: ReadonlyMap<string, string>): string[] {
  return DOCUMENTS.filter((d) => !isDocComplete(d, docStatus.get(d.type))).map((d) => d.label);
}
