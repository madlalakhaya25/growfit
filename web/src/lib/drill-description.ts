import type { SessionDrill } from "@/app/actions/session-generator";

/**
 * training.ts's drillSchema caps a drill's `description` at 500 characters —
 * real, genuinely lossy against the AI session generator's now-structured
 * (richer) output, and a deliberate tradeoff rather than something to work
 * around by expanding the DB schema (see docs/BACKLOG.md 3.2's Shipped
 * note). `instructions` is truncated first since the prompt asks the model
 * to write it as multi-step prose, making it the field most likely to run
 * long; the other four lines are only touched if they still don't fit even
 * with instructions emptied.
 *
 * Shared by both Apply entry points — a brand-new session's form and an
 * existing session's drill list — since both ultimately write into the same
 * `training_drills.description` column under the same cap.
 */
export const DRILL_DESCRIPTION_CAP = 500;

export function packDrillDescription(d: SessionDrill): string {
  const label = (k: string, v: string) => `${k}: ${v}`;
  const before = [label("LTPD Focus", d.ltpdFocus), label("4-Corner", d.fourCorner), label("Setup", d.setup)].join("\n");
  const after = label("Coaching Points", d.coachingPoints);
  const instructionsPrefix = "Instructions: ";
  const overhead = before.length + 1 + instructionsPrefix.length + 1 + after.length;
  const budget = DRILL_DESCRIPTION_CAP - overhead;

  let instructions = d.instructions;
  if (budget <= 0) {
    // Even the fixed fields alone don't fit under the cap — fall back to a
    // hard truncation of the whole assembled string rather than erroring.
    const full = [before, `${instructionsPrefix}${instructions}`, after].join("\n");
    return full.slice(0, DRILL_DESCRIPTION_CAP - 1) + "…";
  }
  if (instructions.length > budget) {
    instructions = budget > 1 ? instructions.slice(0, budget - 1).trimEnd() + "…" : "";
  }
  const full = [before, `${instructionsPrefix}${instructions}`, after].join("\n");
  return full.length > DRILL_DESCRIPTION_CAP ? full.slice(0, DRILL_DESCRIPTION_CAP - 1) + "…" : full;
}
