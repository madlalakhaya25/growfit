// The academy's own curriculum (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md,
// Part 1): what the academy teaches, per age group, in its own words, under the
// five development categories. Pure, so Jest can load it. Nothing here writes
// content: the list is the academy's to write, never generated.

import { MILESTONE_CATEGORIES, type MilestoneCategory } from "@/lib/development-categories";

export const MAX_CURRICULUM_TITLE = 200;
export const MAX_CURRICULUM_DESCRIPTION = 600;

export interface CurriculumItem {
  id: string;
  ageGroup: string;
  category: MilestoneCategory;
  title: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
}

/** "u13" -> "U13", " U 11 " -> "U 11" trimmed and upper-cased; null when it cannot be a label. */
export function normalizeAgeGroup(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ").toUpperCase();
  return /^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(t) ? t : null;
}

export interface CleanCurriculumInput {
  ageGroup: string;
  category: MilestoneCategory;
  title: string;
  description: string | null;
}

/**
 * What is worth saving from anything sent to a create or edit action: a label
 * for the age group, a known category, a title of 1 to 200 characters and an
 * optional description of up to 600. Null when anything required is unusable.
 * Over-long text is refused, never silently cut.
 */
export function cleanCurriculumInput(raw: unknown): CleanCurriculumInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const ageGroup = normalizeAgeGroup(r.ageGroup);
  const category = MILESTONE_CATEGORIES.find((c) => c === r.category);
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!ageGroup || !category || title.length < 1 || title.length > MAX_CURRICULUM_TITLE) return null;

  let description: string | null = null;
  if (r.description !== undefined && r.description !== null) {
    if (typeof r.description !== "string") return null;
    const d = r.description.trim();
    if (d.length > MAX_CURRICULUM_DESCRIPTION) return null;
    description = d.length > 0 ? d : null;
  }
  return { ageGroup, category, title, description };
}

export interface CurriculumGroup {
  category: MilestoneCategory;
  items: CurriculumItem[];
}

/**
 * One age group's active items in the five categories' fixed order, each list
 * by sort order then title then id, so the same data always reads the same way.
 * Every category appears, empty or not, so a gap is visible.
 */
export function groupForAgeGroup(items: readonly CurriculumItem[], ageGroup: string): CurriculumGroup[] {
  const wanted = normalizeAgeGroup(ageGroup);
  return MILESTONE_CATEGORIES.map((category) => ({
    category,
    items: items
      .filter((i) => i.active && i.category === category && normalizeAgeGroup(i.ageGroup) === wanted)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
  }));
}

/** The age groups the academy has written items for, in a stable order (U11 before U13). */
export function ageGroupsWithItems(items: readonly CurriculumItem[]): string[] {
  const seen = new Set<string>();
  for (const i of items) {
    const g = normalizeAgeGroup(i.ageGroup);
    if (i.active && g) seen.add(g);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Where a new item goes: after the last one in its age group and category. */
export function nextSortOrder(items: readonly CurriculumItem[], ageGroup: string, category: MilestoneCategory): number {
  const wanted = normalizeAgeGroup(ageGroup);
  const orders = items
    .filter((i) => i.category === category && normalizeAgeGroup(i.ageGroup) === wanted)
    .map((i) => i.sortOrder);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/** True when nothing has been written yet, so a screen shows the "start here" prompt. */
export function curriculumIsEmpty(items: readonly CurriculumItem[]): boolean {
  return !items.some((i) => i.active);
}

/**
 * Moving an item up or down swaps places with its neighbour in the same age
 * group and category, among active items only. Returns the two new positions
 * to write, or null when the item is not there, retired, or already at that end.
 */
export function swapWithNeighbour(
  items: readonly CurriculumItem[],
  id: string,
  direction: "up" | "down",
): { id: string; sortOrder: number }[] | null {
  const item = items.find((i) => i.id === id);
  if (!item?.active) return null;
  const list = groupForAgeGroup(items, item.ageGroup).find((g) => g.category === item.category)?.items ?? [];
  const at = list.findIndex((i) => i.id === id);
  const other = list[direction === "up" ? at - 1 : at + 1];
  if (at < 0 || !other) return null;
  const neighbourAt = direction === "up" ? at - 1 : at + 1;
  // Equal positions would make the swap a no-op, so fall back to list places.
  const tied = item.sortOrder === other.sortOrder;
  return [
    { id: item.id, sortOrder: tied ? neighbourAt : other.sortOrder },
    { id: other.id, sortOrder: tied ? at : item.sortOrder },
  ];
}
