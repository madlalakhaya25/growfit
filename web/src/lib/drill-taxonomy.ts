import type { MilestoneCategory } from "@/lib/development-categories";

/**
 * Three category vocabularies describe "kinds of football work" in this app,
 * and they are NOT the same thing. They are mapped by hand, at the boundary
 * where one meets another, so the mismatch is a decision someone can read and
 * not a shared enum that pretends the three agree.
 *
 *  1. `drill_library.category` (migration 012): six values -- below.
 *  2. The session page's drill kind (`coach/training/[id]/page.tsx`):
 *     `technical | tactical | fitness`. Three values, and `fitness` is not
 *     `physical`.
 *  3. The development corners (`lib/development-categories.ts`): five values --
 *     technical, tactical, physical, mental, leadership.
 *
 * Do not merge these. If a fourth boundary needs a mapping, add a function
 * here with its own comment.
 */
export const DRILL_CATEGORIES = ["warm_up", "technical", "tactical", "physical", "small_sided", "cool_down"] as const;
export type DrillCategory = (typeof DRILL_CATEGORIES)[number];

export function isDrillCategory(v: unknown): v is DrillCategory {
  return typeof v === "string" && (DRILL_CATEGORIES as readonly string[]).includes(v);
}

/**
 * Boundary: the session page's three-way kind -> a library category.
 * `fitness` means conditioning, which the library calls `physical`; the other
 * two share a spelling and a meaning.
 */
export function drillCategoryFromSessionKind(kind: string): DrillCategory | null {
  switch (kind) {
    case "technical": return "technical";
    case "tactical": return "tactical";
    case "fitness": return "physical";
    default: return null;
  }
}

/**
 * Boundary: a development corner -> the library category that trains it.
 * Only three corners have a drill category of their own. `mental` and
 * `leadership` are developed inside every kind of session, so there is no
 * honest single category to filter by; they return null rather than a guess.
 */
export function drillCategoryForCorner(corner: MilestoneCategory): DrillCategory | null {
  switch (corner) {
    case "technical": return "technical";
    case "tactical": return "tactical";
    case "physical": return "physical";
    default: return null;
  }
}
