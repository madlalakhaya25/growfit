import type { Band } from "@/lib/term-review";
import { BAND_LABELS } from "@/lib/term-review";

/**
 * A player's own rating of themself, and what a coach does with it.
 *
 * The child rates 1 to 5 per category. The coach rates in four bands. To put
 * them side by side the 1-5 answer is mapped onto the bands (`selfToBand`), and
 * a difference of a whole band or more becomes a conversation starter for the
 * COACH (`gapPrompt`). It is never shown as a number, never a "score", and it
 * is not shown to other players or to parents.
 */

export type SelfRating = 1 | 2 | 3 | 4 | 5;
export const SELF_RATINGS: readonly SelfRating[] = [1, 2, 3, 4, 5];

export function isSelfRating(value: unknown): value is SelfRating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** What each answer is called on the child's screen. */
export const SELF_RATING_LABELS: Record<SelfRating, string> = {
  1: "Just starting",
  2: "Getting there",
  3: "Okay",
  4: "Good",
  5: "Really good",
};

/** 1 to Emerging, 2 to Developing, 3 and 4 to Secure, 5 to Excelling. */
export function selfToBand(rating: SelfRating): Band {
  return ([1, 2, 3, 3, 4] as const)[rating - 1];
}

export type Gap = "match" | "child-higher" | "child-lower";

export function gapBetween(rating: SelfRating, coachBand: Band): Gap {
  const d = selfToBand(rating) - coachBand;
  if (d > 0) return "child-higher";
  if (d < 0) return "child-lower";
  return "match";
}

/**
 * A question for the coach to ask, or null when the two agree. Written to open
 * a conversation, so it never says who is right.
 */
export function gapPrompt(label: string, rating: SelfRating, coachBand: Band): string | null {
  switch (gapBetween(rating, coachBand)) {
    case "child-higher":
      return `${label}: they feel ${SELF_RATING_LABELS[rating].toLowerCase()}, you see ${BAND_LABELS[coachBand]}. Ask what they notice that you might not.`;
    case "child-lower":
      return `${label}: they feel ${SELF_RATING_LABELS[rating].toLowerCase()}, you see ${BAND_LABELS[coachBand]}. Ask what is holding their confidence back.`;
    default:
      return null;
  }
}

/** Faces for the youngest age group. U12 and below, same cut-off as the pitch size. */
export function usesFaces(ageGroup: string | null | undefined): boolean {
  const n = Number(/^U(\d{1,2})$/i.exec((ageGroup ?? "").trim())?.[1]);
  return Number.isFinite(n) && n <= 12;
}
