// What the academy has actually trained against its own curriculum, from the
// links coaches made (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md,
// Part 1, screen 3). Computed, never typed in. Pure, so Jest can load it.
// Dates are plain YYYY-MM-DD strings (comparing them as strings is correct for
// that format and avoids timezone traps).

import type { MilestoneCategory } from "@/lib/development-categories";
import { addDays } from "@/lib/week-plan";
import { ageGroupsWithItems, groupForAgeGroup, type CurriculumItem } from "@/lib/curriculum";

export interface CoverageLink {
  itemId: string;
  linkType: string;
  linkId: string;
}

/** A training session a link may point at. `date` is its day, YYYY-MM-DD. */
export interface CoverageSession {
  id: string;
  date: string;
}

export interface CoverageWindow {
  /** First day counted, inclusive. */
  from: string;
  /** Last day counted, inclusive. Sessions after it have not happened yet. */
  to: string;
}

export interface ItemCoverage {
  item: CurriculumItem;
  /** Distinct sessions in the window linked to this item. */
  sessions: number;
  /** Open or closed objectives linked to this item (any time). */
  objectives: number;
  /** The latest day in the window a linked session was held, or null. */
  lastTrained: string | null;
}

export interface CategoryCoverage {
  category: MilestoneCategory;
  items: ItemCoverage[];
}

export interface AgeGroupCoverage {
  ageGroup: string;
  categories: CategoryCoverage[];
  /** Items with no session in the window, in curriculum order: the useful list. */
  notTouched: ItemCoverage[];
  /** Share of items trained at least once, 0 to 100, whole number; 0 for an empty group. */
  coveragePercent: number;
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const set = map.get(key);
  if (set) set.add(value);
  else map.set(key, new Set([value]));
}

/**
 * The days to measure: the latest school term that has started, up to today (or
 * to its last day in the holiday after it), or the last 90 days when none has.
 * A term that has not started is never used, so a holiday never reads as
 * "nothing trained" for a term that has not begun.
 */
export function coverageWindow(terms: readonly { starts_on: string; ends_on: string }[], today: string): CoverageWindow {
  const started = [...terms]
    .filter((t) => t.starts_on <= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const term = started.at(-1);
  if (term) return { from: term.starts_on, to: term.ends_on < today ? term.ends_on : today };
  return { from: addDays(today, -90), to: today };
}

/**
 * Coverage per age group over a window. Only active items count. A session is
 * counted once per item however many links point at it, and only when its day
 * is inside the window, so future plans are never shown as "trained".
 * Objective links count separately because an objective is intent, not training.
 */
export function computeCoverage(
  items: readonly CurriculumItem[],
  links: readonly CoverageLink[],
  sessions: readonly CoverageSession[],
  window: CoverageWindow,
): AgeGroupCoverage[] {
  const dayOf = new Map(sessions.map((s) => [s.id, s.date]));

  const trained = new Map<string, Set<string>>();
  const objectives = new Map<string, Set<string>>();
  for (const l of links) {
    if (l.linkType === "session") {
      const day = dayOf.get(l.linkId);
      if (day === undefined || day < window.from || day > window.to) continue;
      addTo(trained, l.itemId, l.linkId);
    } else if (l.linkType === "objective") {
      addTo(objectives, l.itemId, l.linkId);
    }
  }

  const coverageOf = (item: CurriculumItem): ItemCoverage => {
    const ids = trained.get(item.id) ?? new Set<string>();
    const days = [...ids].map((id) => dayOf.get(id)!).sort((a, b) => a.localeCompare(b));
    return {
      item,
      sessions: ids.size,
      objectives: objectives.get(item.id)?.size ?? 0,
      lastTrained: days.at(-1) ?? null,
    };
  };

  return ageGroupsWithItems(items).map((ageGroup) => {
    const categories = groupForAgeGroup(items, ageGroup).map((g) => ({
      category: g.category,
      items: g.items.map(coverageOf),
    }));
    const all = categories.flatMap((c) => c.items);
    return {
      ageGroup,
      categories,
      notTouched: all.filter((i) => i.sessions === 0),
      coveragePercent: all.length === 0 ? 0 : Math.round((all.filter((i) => i.sessions > 0).length / all.length) * 100),
    };
  });
}
