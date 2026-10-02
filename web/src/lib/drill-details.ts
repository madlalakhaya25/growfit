// A generated drill's full plan, kept beside the 500-character description.
//
// `training_drills.description` is capped at 500 characters, so a generated
// drill's instructions were being cut and its diagram thrown away on save.
// Migration 052 adds a `details` JSON column; this module is the pure half:
// what of a stored or submitted value is believed, so a hand-edited row or a
// hostile request can never put an oversized or malformed blob in front of
// the renderer. Anything unusable comes back as null and the drill is shown
// from its description alone, as before.

import { validateDiagram, type DrillDiagram } from "@/lib/drill-diagram";

export interface DrillDetails {
  durationMinutes: number;
  ltpdFocus: string;
  fourCorner: string;
  setup: string;
  instructions: string;
  coachingPoints: string;
  diagram?: DrillDiagram;
}

const SHORT = 500;
const LONG = 2000;
const MAX_MINUTES = 180;

function text(value: unknown, cap: number): string {
  return typeof value === "string" ? value.trim().slice(0, cap) : "";
}

export function sanitiseDrillDetails(raw: unknown): DrillDetails | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const minutes = Number(r.durationMinutes);
  const details: DrillDetails = {
    durationMinutes: Number.isFinite(minutes) ? Math.min(MAX_MINUTES, Math.max(0, Math.round(minutes))) : 0,
    ltpdFocus: text(r.ltpdFocus, SHORT),
    fourCorner: text(r.fourCorner, SHORT),
    setup: text(r.setup, SHORT),
    instructions: text(r.instructions, LONG),
    coachingPoints: text(r.coachingPoints, SHORT),
  };

  // Nothing worth keeping: not a plan, so do not store an empty shell.
  const hasContent = details.instructions || details.setup || details.coachingPoints || details.ltpdFocus || details.fourCorner;
  const diagram = validateDiagram(r.diagram);
  if (!hasContent && !diagram) return null;
  if (diagram) details.diagram = diagram;
  return details;
}
