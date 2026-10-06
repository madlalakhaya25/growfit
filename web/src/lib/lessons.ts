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
