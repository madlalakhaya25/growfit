/**
 * School terms: the dates a term review is measured against.
 *
 * Pure helpers only (no Supabase), so the date rules are testable. Dates are
 * plain `YYYY-MM-DD` strings throughout; comparing them as strings is correct
 * for that format and avoids every timezone trap that `new Date()` brings.
 */

export interface TermDates {
  name: string;
  starts_on: string;
  ends_on: string;
}

/**
 * South African public school terms, per the Department of Basic Education.
 * Only years listed here are exact; any other year is an estimate (below).
 */
const KNOWN_TERMS: Record<number, [string, string][]> = {
  2026: [
    ["01-14", "03-27"],
    ["04-08", "06-26"],
    ["07-21", "10-02"],
    ["10-13", "12-09"],
  ],
};

/** The 2026 pattern, reused for years we have no published calendar for. */
const ESTIMATE_PATTERN = KNOWN_TERMS[2026];

export interface TermSuggestion {
  terms: TermDates[];
  /** True when the dates are an estimate the admin must check. */
  approximate: boolean;
}

/** Four proposed terms for a year. The admin confirms or edits them. */
export function suggestTerms(year: number): TermSuggestion {
  const known = KNOWN_TERMS[year];
  const pattern = known ?? ESTIMATE_PATTERN;
  return {
    approximate: !known,
    terms: pattern.map(([start, end], i) => ({
      name: `Term ${i + 1} ${year}`,
      starts_on: `${year}-${start}`,
      ends_on: `${year}-${end}`,
    })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Why a term can't be saved, or null when it can. */
export function termProblem(t: TermDates): string | null {
  const name = t.name.trim();
  if (name.length < 1 || name.length > 60) return "A term needs a name of up to 60 characters.";
  if (!isIsoDate(t.starts_on) || !isIsoDate(t.ends_on)) return "Use real dates for the start and end of the term.";
  if (t.ends_on < t.starts_on) return "A term can't end before it starts.";
  return null;
}

/**
 * The term running on `today`, else the next one to start, else the one that
 * ended most recently. Null only when there are no terms at all.
 */
export function currentTerm<T extends { starts_on: string; ends_on: string }>(
  terms: T[],
  today: string
): T | null {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  return (
    sorted.find((t) => t.starts_on <= today && today <= t.ends_on) ??
    sorted.find((t) => t.starts_on > today) ??
    sorted[sorted.length - 1]
  );
}

/** Terms whose date ranges overlap another's, so the admin can be told. */
export function overlappingTerms<T extends { starts_on: string; ends_on: string }>(terms: T[]): T[] {
  const sorted = [...terms].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const out = new Set<T>();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].starts_on <= sorted[i - 1].ends_on) {
      out.add(sorted[i - 1]);
      out.add(sorted[i]);
    }
  }
  return [...out];
}
