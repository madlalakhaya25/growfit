// Pure helpers for AI session plans: the prose renderer and the validator for
// a model-written progression. Kept out of the "use server" files so Jest can
// test them without importing @google/genai.

import type { SessionDrill, SessionPlanStructured } from "@/app/actions/session-generator";

/**
 * Renders the exact "DRILL N: Name (X min)" prose shape the old freeform
 * prompt produced, from the structured data -- session-generator-panel.tsx
 * splits on `/(?=DRILL \d+:)/g` to render each drill, so every generator that
 * writes a SessionPlanStructured can reuse that display unchanged.
 */
export function renderSessionPlanProse(s: SessionPlanStructured): string {
  const lines: string[] = [];
  s.drills.forEach((d, i) => {
    if (i > 0) lines.push("");
    lines.push(`DRILL ${i + 1}: ${d.name} (${d.durationMinutes} min)`);
    lines.push(`LTPD Focus: ${d.ltpdFocus}`);
    lines.push(`4-Corner: ${d.fourCorner}`);
    lines.push(`Setup: ${d.setup}`);
    lines.push(`Instructions: ${d.instructions}`);
    lines.push(`Coaching Points: ${d.coachingPoints}`);
  });
  lines.push("");
  lines.push(`COACH REFLECTION: ${s.coachReflection}`);
  return lines.join("\n");
}

/** A progression is unopposed -> opposed -> small-sided game. */
export const PROGRESSION_STAGES = ["Unopposed", "Opposed", "Small-sided game"] as const;
export const PROGRESSION_LENGTH = PROGRESSION_STAGES.length;
const MAX_DRILL_MINUTES = 30;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\*/g, "").trim().slice(0, max) : "";

/**
 * Trust only what the session page can store: strings of sane length, a whole
 * number of minutes in a sane range, no more than three drills. A drill with no
 * name or no instructions is dropped rather than saved half-empty. Fewer than
 * two usable drills is not a progression, so it returns null and the caller
 * says so instead of showing one lonely drill.
 */
export function validateProgression(raw: Record<string, unknown> | null): SessionPlanStructured | null {
  if (!raw || !Array.isArray(raw.drills)) return null;
  const drills: SessionDrill[] = [];
  for (const item of raw.drills) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const name = str(d.name, 80);
    const instructions = str(d.instructions, 1200);
    if (!name || !instructions) continue;
    const minutes = Math.round(Number(d.durationMinutes));
    drills.push({
      name,
      durationMinutes: Number.isFinite(minutes) ? Math.min(Math.max(minutes, 1), MAX_DRILL_MINUTES) : 10,
      ltpdFocus: str(d.ltpdFocus, 200),
      fourCorner: str(d.fourCorner, 60),
      setup: str(d.setup, 600),
      instructions,
      coachingPoints: str(d.coachingPoints, 400),
    });
    if (drills.length === PROGRESSION_LENGTH) break;
  }
  if (drills.length < 2) return null;
  return { drills, coachReflection: str(raw.coachReflection, 400) };
}
