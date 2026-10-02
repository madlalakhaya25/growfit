import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_META, type MilestoneCategory } from "@/lib/development-categories";

/**
 * What a squad's approved development plans have in common, so a coach can
 * plan a session around it ("7 of 18 are working on technical, mostly first
 * touch") instead of around one child.
 *
 * Category is the reliable grouping: the model's free-text `area` varies
 * ("first touch", "First touch under pressure"), so areas are only used to name
 * what the group is working on, most common first.
 */

export interface PlanFocus {
  playerId: string;
  focusAreas: { category: MilestoneCategory; area: string }[];
}

export interface SquadFocusRow {
  category: MilestoneCategory;
  label: string;
  /** Players whose plan has at least one focus area in this category. */
  players: number;
  /** Most common areas first, at most three. */
  areas: string[];
}

export interface SquadFocus {
  rows: SquadFocusRow[];
  /** Players with an approved plan. */
  planned: number;
  /** Everyone on the squad, so the card can say "7 of 18". */
  squadSize: number;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function tallySquadFocus(plans: PlanFocus[], squadSize: number): SquadFocus {
  const byCategory = new Map<MilestoneCategory, { players: Set<string>; areas: Map<string, { text: string; n: number }> }>();
  const seenPlayers = new Set<string>();

  for (const plan of plans) {
    if (plan.focusAreas.length === 0) continue;
    seenPlayers.add(plan.playerId);
    for (const f of plan.focusAreas) {
      const entry = byCategory.get(f.category) ?? { players: new Set<string>(), areas: new Map() };
      entry.players.add(plan.playerId);
      const key = norm(f.area);
      if (key) {
        const a = entry.areas.get(key) ?? { text: f.area.trim(), n: 0 };
        a.n += 1;
        entry.areas.set(key, a);
      }
      byCategory.set(f.category, entry);
    }
  }

  const rows = MILESTONE_CATEGORIES.filter((c) => byCategory.has(c))
    .map((category): SquadFocusRow => {
      const e = byCategory.get(category)!;
      const areas = [...e.areas.values()]
        .sort((a, b) => b.n - a.n || a.text.localeCompare(b.text))
        .slice(0, 3)
        .map((a) => a.text);
      return { category, label: MILESTONE_CATEGORY_META[category].label, players: e.players.size, areas };
    })
    .sort((a, b) => b.players - a.players || MILESTONE_CATEGORIES.indexOf(a.category) - MILESTONE_CATEGORIES.indexOf(b.category));

  return { rows, planned: seenPlayers.size, squadSize };
}

/** The sentence for one row, e.g. "7 of 18 are working on Technical: first touch, passing." */
export function focusSentence(row: SquadFocusRow, squadSize: number): string {
  const areas = row.areas.length ? `: ${row.areas.join(", ")}` : "";
  return `${row.players} of ${squadSize} ${row.players === 1 ? "is" : "are"} working on ${row.label}${areas}.`;
}

/** What to preselect as the session's focus: the top area of a row, else its category label. */
export function focusForSession(row: SquadFocusRow): string {
  return row.areas[0] ?? row.label;
}

/**
 * A focus arriving in a link, made safe to put in a session prompt: one short
 * line of plain words. Anything else (newlines, symbols, markup) is dropped, so
 * a crafted link cannot smuggle instructions into the generator.
 */
export function cleanFocus(raw: string | null | undefined): string | undefined {
  const text = (raw ?? "").replace(/[^\p{L}\p{N} &',-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return text.length >= 2 ? text : undefined;
}
