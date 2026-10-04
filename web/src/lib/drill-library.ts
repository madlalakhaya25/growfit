/**
 * The academy drill library: one method taught the same way at U11, U13 and
 * U15. This module is the pure half — the fixed tag lists (mirrored by the
 * CHECK constraints in migration 065), what of a submitted value is believed,
 * and how the Library page filters and orders drills. No database, no React.
 */

export const LIBRARY_AGE_GROUPS = ["U11", "U13", "U15"] as const;
export type LibraryAgeGroup = (typeof LIBRARY_AGE_GROUPS)[number];

/** Themes: the 4-corner model and the phases of play, in the order coaches
 *  think about a session (ball work first, then out of possession, then the rest). */
export const DRILL_THEMES = [
  { value: "passing", label: "Passing" },
  { value: "receiving", label: "Receiving" },
  { value: "dribbling", label: "Dribbling" },
  { value: "finishing", label: "Finishing" },
  { value: "defending", label: "Defending" },
  { value: "pressing", label: "Pressing" },
  { value: "transitions", label: "Transitions" },
  { value: "set_pieces", label: "Set pieces" },
  { value: "fitness", label: "Fitness" },
  { value: "mental", label: "Mental" },
] as const;
export type DrillTheme = (typeof DRILL_THEMES)[number]["value"];

/** FIFA 4-corner model. Its own vocabulary — see lib/drill-taxonomy.ts for why
 *  the app keeps category vocabularies apart rather than merging them. */
export const FOUR_CORNERS = [
  { value: "technical", label: "Technical" },
  { value: "tactical", label: "Tactical" },
  { value: "physical", label: "Physical" },
  { value: "psychological", label: "Psychological" },
] as const;
export type FourCorner = (typeof FOUR_CORNERS)[number]["value"];

const THEME_VALUES: readonly string[] = DRILL_THEMES.map((t) => t.value);
const CORNER_VALUES: readonly string[] = FOUR_CORNERS.map((c) => c.value);

export const MAX_EQUIPMENT = 300;
export const MAX_COACHING_POINTS = 1000;
export const MAX_PLAYERS = 40;

export function themeLabel(value: string): string {
  return DRILL_THEMES.find((t) => t.value === value)?.label ?? value;
}

export function fourCornerLabel(value: string): string {
  return FOUR_CORNERS.find((c) => c.value === value)?.label ?? value;
}

export function isFourCorner(v: unknown): v is FourCorner {
  return typeof v === "string" && CORNER_VALUES.includes(v);
}

/** Keep only known values, de-duplicated, in the list's own order. */
function pick<T extends string>(raw: unknown, allowed: readonly string[]): T[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter((v): v is string => typeof v === "string"));
  return allowed.filter((v) => wanted.has(v)) as T[];
}

export function sanitiseAgeGroups(raw: unknown): LibraryAgeGroup[] {
  return pick<LibraryAgeGroup>(raw, LIBRARY_AGE_GROUPS);
}

export function sanitiseThemes(raw: unknown): DrillTheme[] {
  return pick<DrillTheme>(raw, THEME_VALUES);
}

/** "U13 Eagles", "u13", "Under 13" → "U13"; anything else → null. */
export function ageGroupFromTeam(ageGroup: string | null | undefined): LibraryAgeGroup | null {
  const m = /\b(?:u|under)[\s-]?(\d{1,2})\b/i.exec(ageGroup ?? "");
  if (!m) return null;
  const candidate = `U${Number(m[1])}`;
  return (LIBRARY_AGE_GROUPS as readonly string[]).includes(candidate) ? (candidate as LibraryAgeGroup) : null;
}

/** 1–40 players, or null when blank or nonsense. */
export function sanitisePlayersNeeded(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(MAX_PLAYERS, n);
}

export function sanitiseText(raw: unknown, cap: number): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, cap);
  return t || null;
}

/** The tag fields a library drill carries on top of migration 012's columns. */
export interface LibraryTags {
  age_groups: LibraryAgeGroup[];
  themes: DrillTheme[];
  four_corner: FourCorner | null;
  players_needed: number | null;
  equipment: string | null;
  coaching_points: string | null;
  tactic_play_id: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitiseLibraryTags(raw: Partial<Record<keyof LibraryTags, unknown>>): LibraryTags {
  const playId = typeof raw.tactic_play_id === "string" && UUID_RE.test(raw.tactic_play_id) ? raw.tactic_play_id : null;
  return {
    age_groups: sanitiseAgeGroups(raw.age_groups),
    themes: sanitiseThemes(raw.themes),
    four_corner: isFourCorner(raw.four_corner) ? raw.four_corner : null,
    players_needed: sanitisePlayersNeeded(raw.players_needed),
    equipment: sanitiseText(raw.equipment, MAX_EQUIPMENT),
    coaching_points: sanitiseText(raw.coaching_points, MAX_COACHING_POINTS),
    tactic_play_id: playId,
  };
}

/** Read the tag fields of a drill form (DrillTagFields). Unsanitised: the
 *  server action runs sanitiseLibraryTags on whatever arrives. */
export function tagsFromFormData(fd: FormData): Partial<Record<keyof LibraryTags, unknown>> {
  const value = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v !== "" ? v : null;
  };
  return {
    age_groups: fd.getAll("age_groups"),
    themes: fd.getAll("themes"),
    four_corner: value("four_corner"),
    players_needed: value("players_needed"),
    equipment: value("equipment"),
    coaching_points: value("coaching_points"),
    tactic_play_id: value("tactic_play_id"),
  };
}

/** What the filter and sort need from a drill. */
export interface FilterableDrill {
  name: string;
  description?: string | null;
  coaching_points?: string | null;
  equipment?: string | null;
  age_groups?: readonly string[] | null;
  themes?: readonly string[] | null;
  is_academy_method?: boolean | null;
}

export interface LibraryFilter {
  query?: string;
  ageGroups?: readonly string[];
  themes?: readonly string[];
}

function matchesQuery(drill: FilterableDrill, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const themeText = (drill.themes ?? []).map(themeLabel).join(" ");
  const haystack = [drill.name, drill.description, drill.coaching_points, drill.equipment, themeText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Any selected chip in a facet matches (OR); an empty facet matches all. */
function matchesFacet(values: readonly string[] | null | undefined, selected: readonly string[] | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  const have = new Set(values ?? []);
  return selected.some((s) => have.has(s));
}

/**
 * Search words must all appear (name, description, coaching points, equipment
 * or theme names). Age group and theme chips: any chip within a facet, and
 * both facets together.
 */
export function filterDrills<T extends FilterableDrill>(drills: readonly T[], filter: LibraryFilter): T[] {
  return drills.filter(
    (d) =>
      matchesQuery(d, filter.query ?? "") &&
      matchesFacet(d.age_groups, filter.ageGroups) &&
      matchesFacet(d.themes, filter.themes)
  );
}

/** Academy method drills first, then A–Z by name. Does not mutate. */
export function sortDrills<T extends FilterableDrill>(drills: readonly T[]): T[] {
  return [...drills].sort((a, b) => {
    const curated = Number(Boolean(b.is_academy_method)) - Number(Boolean(a.is_academy_method));
    if (curated !== 0) return curated;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

/** Tap a chip: add it if absent, remove it if present. */
export function toggleChip<T extends string>(selected: readonly T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}
