// Rewriting a coach's note for a child of a given age: the pure half.

import { createHash } from "node:crypto";

export const MIN_REWRITE_AGE = 6;
export const MAX_REWRITE_AGE = 18;
export const MAX_REWRITE_CHARS = 1500;

/** "U11" -> 11, "u13s" -> 13, 9 -> 9. null when there is no age to go on (the
 * caller then refuses rather than guessing a reading level). Clamped to the
 * ages the academy actually coaches plus a little either side. */
export function ageFromAgeGroup(ageGroup: string | number | null | undefined): number | null {
  const n = typeof ageGroup === "number" ? ageGroup : parseInt(String(ageGroup ?? "").match(/\d+/)?.[0] ?? "", 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.round(n), MIN_REWRITE_AGE), MAX_REWRITE_AGE);
}

/** What the model is shown, and what is fingerprinted. */
export function rewriteBrief(text: string, age: number): string {
  return `AGE: ${age}\nNOTE:\n${text.trim()}`;
}

/** A stable UUID for one (age, note): the cache key. The same note for the
 * same age always lands on the same artefact; any change to either does not. */
export function rewriteSubjectId(text: string, age: number): string {
  const h = createHash("sha256").update(rewriteBrief(text, age), "utf8").digest("hex");
  // Shape it as a v4-style UUID (the column is UUID). Not for security.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Numbers in the note (times, dates, amounts, kit numbers) that the rewrite
 * dropped or changed. A simpler note must still say "17:00" and "R50"; if a
 * figure went missing the coach is told to check, because the model is the
 * one thing here that might quietly change a time.
 */
export function missingNumbers(source: string, rewritten: string): string[] {
  const nums = (t: string) => t.match(/\d+(?:[.,:]\d+)*/g) ?? [];
  const have = new Set(nums(rewritten));
  return [...new Set(nums(source))].filter((n) => !have.has(n));
}

/** Plain-text tidy of a model reply. */
export function cleanRewrite(raw: string): string {
  return raw.replace(/\*/g, "").replace(/^["“]|["”]$/g, "").trim();
}
