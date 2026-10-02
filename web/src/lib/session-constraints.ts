// Real-world limits on a training session: how much space, what kit, how many
// players turn up. Pure and shared by both session-generator forms and the
// server action, so a request can only ever name an option that exists here.

export const SPACE_OPTIONS = [
  { value: "full", label: "Full pitch", hint: "a full-size pitch" },
  { value: "half", label: "Half pitch", hint: "about half a pitch" },
  { value: "quarter", label: "Small grid", hint: "a small grid, roughly 20m by 30m in total" },
  { value: "tight", label: "Tight space", hint: "a very tight space such as a yard, court or car park, roughly 15m by 20m" },
] as const;
export type SpaceValue = (typeof SPACE_OPTIONS)[number]["value"];

export const KIT_OPTIONS = [
  { value: "balls", label: "Balls" },
  { value: "cones", label: "Cones" },
  { value: "bibs", label: "Bibs" },
  { value: "goals", label: "Goals" },
  { value: "ladders", label: "Agility ladders" },
] as const;
export type KitValue = (typeof KIT_OPTIONS)[number]["value"];

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 40;
export const MIN_MINUTES = 20;
export const MAX_MINUTES = 150;

export interface SessionConstraints {
  squadSize: number;
  durationMinutes: number;
  /** Absent = the coach didn't say, so the model isn't told to assume anything. */
  space?: SpaceValue;
  /** Absent = unspecified. An empty list = the coach ticked nothing. */
  kit?: KitValue[];
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

/** Only values from the lists above survive; counts and minutes are clamped. */
export function normaliseConstraints(raw: {
  squadSize?: unknown; durationMinutes?: unknown; space?: unknown; kit?: unknown;
}): SessionConstraints {
  const space = SPACE_OPTIONS.find((s) => s.value === raw.space)?.value;
  const kit = Array.isArray(raw.kit)
    ? KIT_OPTIONS.map((k) => k.value).filter((k) => (raw.kit as unknown[]).includes(k))
    : undefined;
  return {
    squadSize: clampInt(raw.squadSize, MIN_PLAYERS, MAX_PLAYERS, 16),
    durationMinutes: clampInt(raw.durationMinutes, MIN_MINUTES, MAX_MINUTES, 75),
    ...(space ? { space } : {}),
    ...(kit ? { kit } : {}),
  };
}

/** The constraint lines the prompt carries, and the rules that make the model obey them. */
export function constraintLines(c: SessionConstraints): string[] {
  const lines = [`- Players available: ${c.squadSize}. Every drill must work for exactly this many, with sensible groups (use a neutral or floater player for odd numbers).`];
  lines.push(`- Total time: ${c.durationMinutes} minutes, including water breaks and transitions.`);
  if (c.space) {
    const hint = SPACE_OPTIONS.find((s) => s.value === c.space)!.hint;
    lines.push(`- Space: ${hint}. Every pitch size you give must fit inside it, with zones marked off rather than extra pitches.`);
  }
  if (c.kit) {
    const labels = KIT_OPTIONS.filter((k) => c.kit!.includes(k.value)).map((k) => k.label.toLowerCase());
    lines.push(
      labels.length
        ? `- Kit available: ${labels.join(", ")}. Use ONLY this kit; where something is missing, improvise (bibs or cones as markers, a line as a goal) and say how.`
        : "- Kit available: none beyond the players. Use only the space and the players, and say how to mark the area.",
    );
  }
  return lines;
}

/** Typical turnout from per-session headcounts, most recent first: the median
 * of up to the last three sessions that have any marks, rounded. null when
 * there is nothing to go on, so the form keeps its default rather than 0. */
export function typicalTurnout(attendedPerSession: number[]): number | null {
  const recent = attendedPerSession.filter((n) => n > 0).slice(0, 3);
  if (recent.length === 0) return null;
  const sorted = [...recent].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.min(Math.max(Math.round(median), MIN_PLAYERS), MAX_PLAYERS);
}
