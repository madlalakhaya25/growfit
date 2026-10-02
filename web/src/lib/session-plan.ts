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
    lines.push(
      `DRILL ${i + 1}: ${d.name} (${d.durationMinutes} min)`,
      `LTPD Focus: ${d.ltpdFocus}`,
      `4-Corner: ${d.fourCorner}`,
      `Setup: ${d.setup}`,
      `Instructions: ${d.instructions}`,
      `Coaching Points: ${d.coachingPoints}`,
    );
  });
  lines.push("", `COACH REFLECTION: ${s.coachReflection}`);
  return lines.join("\n");
}

/** A progression is unopposed -> opposed -> small-sided game. */
export const PROGRESSION_STAGES = ["Unopposed", "Opposed", "Small-sided game"] as const;
export const PROGRESSION_LENGTH = PROGRESSION_STAGES.length;
const MAX_DRILL_MINUTES = 30;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replaceAll("*", "").trim().slice(0, max) : "";

/** Most drills a generated session may carry; the prompt asks for five. */
export const MAX_SESSION_DRILLS = 8;

/**
 * Trust only what the session page can store: strings of sane length, a whole
 * number of minutes in a sane range, and no more than `maxDrills` drills. A
 * drill with no name or no instructions is dropped rather than saved
 * half-empty. Fewer than `minDrills` usable drills is not a plan, so it returns
 * null and the caller says so instead of showing a lonely one.
 */
function readPlan(raw: Record<string, unknown> | null, maxDrills: number, minDrills: number): SessionPlanStructured | null {
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
    if (drills.length === maxDrills) break;
  }
  if (drills.length < minDrills) return null;
  return { drills, coachReflection: str(raw.coachReflection, 400) };
}

/** A model-written progression: two or three drills. */
export function validateProgression(raw: Record<string, unknown> | null): SessionPlanStructured | null {
  return readPlan(raw, PROGRESSION_LENGTH, 2);
}

/** A model-written session: one to MAX_SESSION_DRILLS drills. */
export function validateSessionPlan(raw: Record<string, unknown> | null): SessionPlanStructured | null {
  return readPlan(raw, MAX_SESSION_DRILLS, 1);
}
