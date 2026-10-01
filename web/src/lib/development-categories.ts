import { Activity, Brain, Crown, Footprints, Route, type LucideIcon } from "lucide-react";
import { formatInTimezone } from "@/lib/time";

/**
 * The five development categories, in ONE place.
 *
 * The same five-entry map used to be copy-pasted into four files, and the
 * copies disagreed (`text-blue-700` vs `text-blue-600`) -- and all four used raw
 * Tailwind palette colours, tuned for a light page only, so none of it
 * re-themed. Everything now reads these `--color-dev-*` tokens (globals.css),
 * which have a light and a dark step each.
 *
 * Class strings are written out as literals on purpose: Tailwind scans source,
 * and a template like `bg-dev-${key}` would never be generated.
 *
 * Never `cn()` a `fill` next to another `bg-*` class -- one of the two is
 * dropped silently (the documented pitch-lines / bg-ink bug in globals.css).
 *
 * NOT the drill categories in coach/training/[id]/page.tsx
 * (`technical | tactical | fitness`): three values, and `fitness` is not
 * `physical`. They are unrelated enums that happen to share two words; do not
 * merge them in here.
 */
export type MilestoneCategory =
  | "technical" | "tactical" | "physical" | "mental" | "leadership";

/** Display order. Matches 012_development_features.sql's CHECK order. */
export const MILESTONE_CATEGORIES: readonly MilestoneCategory[] = [
  "technical", "tactical", "physical", "mental", "leadership",
];

export interface MilestoneCategoryMeta {
  key: MilestoneCategory;
  label: string;   // "Technical"
  short: string;   // "Tech" -- the five-up bar strip on a phone
  /** Identity is never colour alone: every category also has an icon and a label. */
  Icon: LucideIcon;
  /** Tinted chip, e.g. "bg-dev-technical/10 text-dev-technical" */
  chip: string;
  /** Solid fill for a bar or a completed check, e.g. "bg-dev-technical" */
  fill: string;
  /** For an inline style() where a class won't do */
  cssVar: string;  // "var(--color-dev-technical)"
}

export const MILESTONE_CATEGORY_META: Record<MilestoneCategory, MilestoneCategoryMeta> = {
  technical: {
    key: "technical", label: "Technical", short: "Tech", Icon: Footprints,
    chip: "bg-dev-technical/10 text-dev-technical", fill: "bg-dev-technical",
    cssVar: "var(--color-dev-technical)",
  },
  tactical: {
    key: "tactical", label: "Tactical", short: "Tact", Icon: Route,
    chip: "bg-dev-tactical/10 text-dev-tactical", fill: "bg-dev-tactical",
    cssVar: "var(--color-dev-tactical)",
  },
  physical: {
    key: "physical", label: "Physical", short: "Phys", Icon: Activity,
    chip: "bg-dev-physical/10 text-dev-physical", fill: "bg-dev-physical",
    cssVar: "var(--color-dev-physical)",
  },
  mental: {
    key: "mental", label: "Mental", short: "Ment", Icon: Brain,
    chip: "bg-dev-mental/10 text-dev-mental", fill: "bg-dev-mental",
    cssVar: "var(--color-dev-mental)",
  },
  leadership: {
    key: "leadership", label: "Leadership", short: "Lead", Icon: Crown,
    chip: "bg-dev-leadership/10 text-dev-leadership", fill: "bg-dev-leadership",
    cssVar: "var(--color-dev-leadership)",
  },
};

/** Null (not a throw, not a silent default) for an unrecognised DB value. */
export function categoryMeta(key: string | null | undefined): MilestoneCategoryMeta | null {
  if (!key) return null;
  return (MILESTONE_CATEGORIES as readonly string[]).includes(key)
    ? MILESTONE_CATEGORY_META[key as MilestoneCategory]
    : null;
}

export interface CategoryProgress {
  key: MilestoneCategory;
  meta: MilestoneCategoryMeta;
  total: number;
  done: number;
  /** Null when total is 0 -- never a misleading 0%. StatTile's convention. */
  pct: number | null;
}

const pct = (done: number, total: number): number | null =>
  total > 0 ? Math.round((done / total) * 100) : null;

export function summariseByCategory(
  templates: readonly { id: string; category: MilestoneCategory }[],
  completedTemplateIds: ReadonlySet<string>
): {
  overall: { total: number; done: number; pct: number | null };
  byCategory: CategoryProgress[]; // only categories with total > 0
} {
  const counts = new Map<MilestoneCategory, { total: number; done: number }>();
  let total = 0;
  let done = 0;
  for (const t of templates) {
    // A category outside the five (a stale row) is counted nowhere rather than
    // being silently folded into one of them.
    if (!categoryMeta(t.category)) continue;
    const c = counts.get(t.category) ?? { total: 0, done: 0 };
    c.total++;
    total++;
    if (completedTemplateIds.has(t.id)) { c.done++; done++; }
    counts.set(t.category, c);
  }
  return {
    overall: { total, done, pct: pct(done, total) },
    byCategory: MILESTONE_CATEGORIES.filter((k) => (counts.get(k)?.total ?? 0) > 0).map((key) => {
      const c = counts.get(key)!;
      return { key, meta: MILESTONE_CATEGORY_META[key], total: c.total, done: c.done, pct: pct(c.done, c.total) };
    }),
  };
}

/**
 * Season key ("2026"). One place, replacing the scattered
 * `new Date().getFullYear()` -- which read the server's local year, so New
 * Year's Eve evening in Durban could land in the wrong season on a UTC host.
 */
export function currentSeason(now: Date = new Date()): string {
  return formatInTimezone(now, { year: "numeric" });
}
