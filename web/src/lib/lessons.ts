// Learning hub: short lessons for coaches (docs/FEATURE_SPECS/learning-hub.md).
// Lessons live in code so a pull request is the review trail. A lesson shows
// only once `approved` is true, which Buhle's sign-off on the wording flips.
// Pure.

export const LESSON_AREAS = [
  { key: "technical", label: "Technical" },
  { key: "tactical", label: "Tactical" },
  { key: "physical", label: "Physical" },
  { key: "psychological", label: "Psychological" },
  { key: "safeguarding", label: "Safeguarding" },
  { key: "goalkeeping", label: "Goalkeeping" },
  { key: "girls", label: "Girls' football" },
  { key: "leadership", label: "Leadership" },
  { key: "management", label: "Academy management" },
  { key: "laws", label: "Laws of the Game" },
  { key: "development", label: "Player development" },
] as const;

export type LessonAreaKey = (typeof LESSON_AREAS)[number]["key"];

export interface Lesson {
  /** Stable, lower-case, hyphenated. Used in the address, so never rename a shown lesson. */
  slug: string;
  area: LessonAreaKey;
  title: string;
  /** One or two sentences: what the coach will know after reading. */
  summary: string;
  /** Short paragraphs, about a two-minute read in all. */
  body: readonly string[];
  /** Match problem keys (lib/match-problems.ts) this lesson helps with. */
  problemKeys?: readonly string[];
  /** Set only after Buhle has approved this exact wording. */
  approved: boolean;
  /** Where the lesson follows a published framework, named so the coach can read the source. */
  source?: string;
}

/** Said on every lesson. The academy's guidance, not anyone's licence or certification. */
export const LESSON_DISCLAIMER =
  "Growfit guidance for volunteer coaches. It is not endorsed by SAFA, CAF or FIFA and does not award a coaching licence.";

/** The lessons a coach may read: approved only, in the order they were written. */
export function approvedLessons(lessons: readonly Lesson[]): Lesson[] {
  return lessons.filter((l) => l.approved);
}

export interface LessonGroup {
  area: (typeof LESSON_AREAS)[number];
  lessons: Lesson[];
}

/** Approved lessons grouped by area in the fixed area order; an area with none is left out. */
export function groupLessons(lessons: readonly Lesson[]): LessonGroup[] {
  const shown = approvedLessons(lessons);
  return LESSON_AREAS
    .map((area) => ({ area, lessons: shown.filter((l) => l.area === area.key) }))
    .filter((g) => g.lessons.length > 0);
}

/** One approved lesson by its address, or null (a draft is "not found", never leaked). */
export function findLesson(lessons: readonly Lesson[], slug: string): Lesson | null {
  return approvedLessons(lessons).find((l) => l.slug === slug) ?? null;
}

/** Approved lessons that name this match problem, for a "read the lesson" link under it. */
export function lessonsForProblem(lessons: readonly Lesson[], problemKey: string | null | undefined): Lesson[] {
  if (!problemKey) return [];
  return approvedLessons(lessons).filter((l) => l.problemKeys?.includes(problemKey));
}

const FIELDS = ["problem", "slug", "area", "title", "summary", "see", "why", "try", "watch"] as const;

/**
 * Reads lessons written as blocks of "name: text" lines, a blank line between blocks.
 * A block missing a field, repeating a slug or naming an unknown area is dropped, so
 * a typo hides one lesson and never shows half of one. Every lesson read this way is
 * marked approved: the text file is the approved wording.
 */
export function parseLessons(text: string): Lesson[] {
  const areas = new Set<string>(LESSON_AREAS.map((a) => a.key));
  const seen = new Set<string>();
  const lessons: Lesson[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const f: Record<string, string> = {};
    for (const line of block.split("\n")) {
      const at = line.indexOf(": ");
      if (at > 0) f[line.slice(0, at).trim()] = line.slice(at + 2).trim();
    }
    if (!FIELDS.every((k) => f[k]) || !areas.has(f.area) || seen.has(f.slug)) continue;
    seen.add(f.slug);
    lessons.push({
      slug: f.slug,
      area: f.area as LessonAreaKey,
      title: f.title,
      summary: f.summary,
      problemKeys: [f.problem],
      body: [`What you see: ${f.see}`, `Why it happens: ${f.why}`, `What to try: ${f.try}`, `Watch for next match: ${f.watch}`],
      approved: true,
    });
  }
  return lessons;
}
