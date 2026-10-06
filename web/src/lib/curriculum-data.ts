// Loader for the academy curriculum (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md).
// It runs through the signed-in user's session, so row security decides who may
// read. A database without migration 068 reads as "no curriculum yet" and never
// blocks the screen that asked.

import type { createClient } from "@/lib/supabase/server";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";
import { curriculumAgeGroupFromTeam, groupForAgeGroup } from "@/lib/curriculum";
import type { CurriculumItem, CurriculumLinkType } from "@/lib/curriculum";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** True when migration 068 has not been run (PostgREST PGRST205, Postgres 42P01). */
export function isMissingCurriculumTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

interface ItemRowDb {
  id: string;
  age_group: string;
  category: string;
  title: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface CurriculumLoad {
  /** False when the table is not there yet, so a screen can say "not set up" rather than "empty". */
  available: boolean;
  items: CurriculumItem[];
}

/** Every item the caller may see, active or retired. An unknown category is dropped, not trusted. */
export async function loadCurriculum(supabase: Supabase): Promise<CurriculumLoad> {
  const { data, error } = await supabase
    .from("curriculum_items")
    .select("id, age_group, category, title, description, sort_order, active")
    .order("age_group", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return { available: !isMissingCurriculumTable(error), items: [] };

  const known = new Set<string>(MILESTONE_CATEGORIES);
  const items = ((data ?? []) as ItemRowDb[]).flatMap((r) =>
    known.has(r.category)
      ? [{
          id: r.id,
          ageGroup: r.age_group,
          category: r.category as CurriculumItem["category"],
          title: r.title,
          description: r.description,
          sortOrder: r.sort_order,
          active: r.active,
        }]
      : [],
  );
  return { available: true, items };
}

/** The curriculum items one session or objective is linked to. Empty when the table is missing. */
export async function loadLinkedItemIds(
  supabase: Supabase, linkType: CurriculumLinkType, linkId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("curriculum_links")
    .select("item_id")
    .eq("link_type", linkType)
    .eq("link_id", linkId);
  if (error) return [];
  return ((data ?? []) as { item_id: string }[]).map((r) => r.item_id);
}

/** What a picker needs for one team's session or objective: the curriculum
 * groups for the team's age group and the item ids already linked. Empty when
 * there is no age group, no items, or migration 068 has not been run. */
export async function loadPickerData(supabase: Supabase, teamAgeGroup: string | null | undefined, linkType: CurriculumLinkType, linkId: string) {
  const age = curriculumAgeGroupFromTeam(teamAgeGroup);
  const groups = age ? groupForAgeGroup((await loadCurriculum(supabase)).items, age) : [];
  const linkedIds = groups.some((g) => g.items.length > 0) ? await loadLinkedItemIds(supabase, linkType, linkId) : [];
  return { groups, linkedIds };
}
