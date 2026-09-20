export type AttrKey =
  | "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical"
  | "ball_control" | "crossing" | "heading" | "tackling" | "finishing" | "first_touch"
  | "stamina" | "agility" | "jumping" | "strength"
  | "positioning" | "decision_making" | "composure" | "work_rate" | "leadership"
  | "shot_stopping" | "reflexes" | "distribution" | "handling"
  | "marking" | "pressing" | "off_ball_movement" | "game_reading" | "communication";

/**
 * The five corners the academy actually works in.
 *
 * These match `development_milestone_templates.category` exactly (migration
 * 012) — technical, tactical, physical, mental, leadership. Attributes used to
 * have only three, with no tactical corner at all and leadership filed under
 * mental, so the attribute model matched neither the milestone taxonomy nor
 * the FIFA 4-Corner Model the academy says it coaches to.
 *
 * Most of the tactical corner already existed and was miscategorised:
 * `positioning` and `decision_making` are game understanding, not psychology.
 */
export type AttrCategory =
  | "technical" | "tactical" | "physical" | "mental" | "leadership";

/** Display order for anything that groups attributes by corner. */
export const ATTR_CATEGORIES: AttrCategory[] = [
  "technical", "tactical", "physical", "mental", "leadership",
];

export const CATEGORY_LABELS: Record<AttrCategory, string> = {
  technical:  "Technical",
  tactical:   "Tactical",
  physical:   "Physical",
  mental:     "Mental",
  leadership: "Leadership",
};

export const ATTR_META: Record<AttrKey, { label: string; category: AttrCategory; color: string }> = {
  pace:              { label: "Pace",              category: "physical",   color: "bg-sky-500" },
  shooting:          { label: "Shooting",          category: "technical",  color: "bg-orange-500" },
  passing:           { label: "Passing",           category: "technical",  color: "bg-emerald-500" },
  dribbling:         { label: "Dribbling",         category: "technical",  color: "bg-violet-500" },
  defending:         { label: "Defending",         category: "technical",  color: "bg-blue-500" },
  // Legacy FIFA "PHY" face stat. Duplicated `strength`'s label exactly, and no
  // position set has ever shown it, so no coach has been asked to rate it. It
  // is NOT NULL DEFAULT 50 and only survives as the fallback for a database
  // missing migration 013 — relabelled so the collision cannot mislead.
  physical:          { label: "Physical (legacy)", category: "physical",   color: "bg-rose-500" },
  ball_control:      { label: "Ball Control",      category: "technical",  color: "bg-violet-400" },
  crossing:          { label: "Crossing",          category: "technical",  color: "bg-teal-500" },
  heading:           { label: "Heading",           category: "technical",  color: "bg-indigo-500" },
  tackling:          { label: "Tackling",          category: "technical",  color: "bg-blue-600" },
  finishing:         { label: "Finishing",         category: "technical",  color: "bg-red-500" },
  first_touch:       { label: "First Touch",       category: "technical",  color: "bg-lime-500" },
  stamina:           { label: "Stamina",           category: "physical",   color: "bg-amber-500" },
  agility:           { label: "Agility",           category: "physical",   color: "bg-cyan-500" },
  jumping:           { label: "Jumping",           category: "physical",   color: "bg-purple-500" },
  strength:          { label: "Strength",          category: "physical",   color: "bg-rose-600" },
  // Recategorised from "mental": reading the game is the tactical corner.
  positioning:       { label: "Positioning",       category: "tactical",   color: "bg-blue-400" },
  decision_making:   { label: "Decision Making",   category: "tactical",   color: "bg-green-500" },
  composure:         { label: "Composure",         category: "mental",     color: "bg-teal-400" },
  work_rate:         { label: "Work Rate",         category: "mental",     color: "bg-orange-400" },
  // Recategorised from "mental": leadership is its own milestone category.
  leadership:        { label: "Leadership",        category: "leadership", color: "bg-yellow-500" },
  shot_stopping:     { label: "Shot Stopping",     category: "technical",  color: "bg-red-600" },
  reflexes:          { label: "Reflexes",          category: "technical",  color: "bg-pink-500" },
  distribution:      { label: "Distribution",      category: "technical",  color: "bg-emerald-600" },
  handling:          { label: "Handling",          category: "technical",  color: "bg-indigo-400" },
  // Added by migration 033 to round out the two new corners.
  marking:           { label: "Marking",           category: "tactical",   color: "bg-blue-700" },
  pressing:          { label: "Pressing",          category: "tactical",   color: "bg-orange-600" },
  off_ball_movement: { label: "Off-Ball Movement", category: "tactical",   color: "bg-lime-600" },
  game_reading:      { label: "Game Reading",      category: "tactical",   color: "bg-green-600" },
  communication:     { label: "Communication",     category: "leadership", color: "bg-yellow-600" },
};

export type PositionAttrSet = Record<AttrCategory, AttrKey[]>;

const GK_ATTRS: PositionAttrSet = {
  technical:  ["shot_stopping", "reflexes", "distribution", "handling"],
  tactical:   ["positioning", "decision_making", "game_reading"],
  physical:   ["agility", "pace", "jumping", "strength"],
  mental:     ["composure"],
  leadership: ["leadership", "communication"],
};
const CB_ATTRS: PositionAttrSet = {
  technical:  ["tackling", "heading", "passing", "ball_control"],
  tactical:   ["positioning", "decision_making", "marking"],
  physical:   ["pace", "strength", "jumping", "stamina"],
  mental:     ["composure"],
  leadership: ["leadership", "communication"],
};
const FULLBACK_ATTRS: PositionAttrSet = {
  technical:  ["crossing", "tackling", "passing", "dribbling"],
  tactical:   ["positioning", "decision_making", "marking"],
  physical:   ["pace", "stamina", "agility", "strength"],
  mental:     ["work_rate", "composure"],
  leadership: [],
};
const WINGBACK_ATTRS: PositionAttrSet = {
  technical:  ["crossing", "dribbling", "passing", "tackling", "finishing"],
  tactical:   ["positioning", "decision_making", "off_ball_movement"],
  physical:   ["pace", "stamina", "agility", "strength"],
  mental:     ["work_rate", "composure"],
  leadership: [],
};
const CDM_ATTRS: PositionAttrSet = {
  technical:  ["tackling", "passing", "ball_control", "heading"],
  tactical:   ["positioning", "decision_making", "pressing"],
  physical:   ["strength", "stamina", "pace", "agility"],
  mental:     ["work_rate", "composure"],
  leadership: [],
};
const CM_ATTRS: PositionAttrSet = {
  technical:  ["passing", "ball_control", "shooting", "tackling", "first_touch"],
  tactical:   ["positioning", "decision_making", "game_reading"],
  physical:   ["stamina", "pace", "agility", "strength"],
  mental:     ["work_rate", "composure"],
  leadership: [],
};
const WIDE_MID_ATTRS: PositionAttrSet = {
  technical:  ["passing", "dribbling", "crossing", "shooting", "first_touch"],
  tactical:   ["positioning", "decision_making", "off_ball_movement"],
  physical:   ["pace", "stamina", "agility", "strength"],
  mental:     ["work_rate", "composure"],
  leadership: [],
};
const CAM_ATTRS: PositionAttrSet = {
  technical:  ["passing", "dribbling", "shooting", "ball_control", "first_touch", "crossing"],
  tactical:   ["positioning", "decision_making", "off_ball_movement", "game_reading"],
  physical:   ["pace", "agility", "stamina"],
  mental:     ["composure", "work_rate"],
  leadership: [],
};
const WINGER_ATTRS: PositionAttrSet = {
  technical:  ["dribbling", "crossing", "finishing", "ball_control", "first_touch"],
  tactical:   ["positioning", "decision_making", "off_ball_movement"],
  physical:   ["pace", "agility", "stamina", "strength"],
  mental:     ["work_rate", "composure"],
  leadership: [],
};
const STRIKER_ATTRS: PositionAttrSet = {
  technical:  ["finishing", "heading", "ball_control", "dribbling", "shooting"],
  tactical:   ["positioning", "decision_making", "off_ball_movement"],
  physical:   ["pace", "strength", "jumping", "agility", "stamina"],
  mental:     ["composure", "work_rate"],
  leadership: [],
};
const SS_ATTRS: PositionAttrSet = {
  technical:  ["finishing", "passing", "dribbling", "ball_control", "first_touch"],
  tactical:   ["positioning", "decision_making", "off_ball_movement"],
  physical:   ["pace", "agility", "stamina", "strength"],
  mental:     ["composure", "work_rate"],
  leadership: [],
};
const DEFAULT_ATTRS: PositionAttrSet = {
  technical:  ["passing", "shooting", "dribbling", "ball_control", "first_touch"],
  tactical:   ["positioning", "decision_making", "game_reading"],
  physical:   ["pace", "stamina", "agility", "strength"],
  mental:     ["composure", "work_rate"],
  leadership: [],
};

const POSITION_ATTR_MAP: Record<string, PositionAttrSet> = {
  gk: GK_ATTRS, goalkeeper: GK_ATTRS,
  cb: CB_ATTRS, sw: CB_ATTRS, defender: CB_ATTRS,
  lb: FULLBACK_ATTRS, rb: FULLBACK_ATTRS,
  lwb: WINGBACK_ATTRS, rwb: WINGBACK_ATTRS,
  cdm: CDM_ATTRS,
  cm: CM_ATTRS, midfielder: CM_ATTRS,
  lm: WIDE_MID_ATTRS, rm: WIDE_MID_ATTRS,
  cam: CAM_ATTRS,
  lw: WINGER_ATTRS, rw: WINGER_ATTRS, winger: WINGER_ATTRS,
  ss: SS_ATTRS,
  st: STRIKER_ATTRS, cf: STRIKER_ATTRS, striker: STRIKER_ATTRS,
};

export function getPositionAttrs(position: string | null | undefined): PositionAttrSet {
  return POSITION_ATTR_MAP[position ?? ""] ?? DEFAULT_ATTRS;
}

export const ALL_ATTR_KEYS: AttrKey[] = Object.keys(ATTR_META) as AttrKey[];

/**
 * Every attribute the assessment form shows for a position, de-duplicated and
 * in display order. This is the set a coach is actually asked to rate, which
 * is what `calculateOverall` averages and what the summary snapshot shows.
 */
export function getPositionAttrKeys(position: string | null | undefined): AttrKey[] {
  const set = getPositionAttrs(position);
  return [...new Set(ATTR_CATEGORIES.flatMap((category) => set[category]))];
}

/**
 * Collapse one row per assessing coach into a single averaged attribute set.
 *
 * Each attribute averages over the coaches who actually rated *it*, not over
 * every row — a coach who left an attribute NULL has not said it is bad, they
 * have said nothing. An attribute nobody rated stays absent, so the passport
 * and the summary snapshot can tell "unrated" from "rated 50".
 *
 * Mirrors what `get_public_passport()` does in SQL with `avg()`, which skips
 * NULLs for the same reason.
 */
export function averageAttributeRows(
  rows: Partial<Record<AttrKey, number | null>>[] | null | undefined
): Partial<Record<AttrKey, number>> | null {
  if (!rows || rows.length === 0) return null;
  const averaged: Partial<Record<AttrKey, number>> = {};
  for (const key of ALL_ATTR_KEYS) {
    const values = rows
      .map((row) => row[key])
      .filter((value): value is number => typeof value === "number");
    if (values.length > 0) {
      averaged[key] = Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length
      );
    }
  }
  return averaged;
}

/**
 * Overall = mean of the attributes assessed for the player's own position.
 *
 * It deliberately does NOT average a fixed set of six columns. The form only
 * ever shows the position's attributes — for a goalkeeper that overlaps the
 * legacy core six in exactly one place (`pace`) — so a fixed-six average was
 * dominated by attributes nobody had rated, and barely moved when a coach
 * edited the sliders in front of them.
 *
 * Returns null when nothing relevant has been assessed, so callers can fall
 * back to a match-rating average.
 */
export function calculateOverall(
  attrs: Partial<Record<AttrKey, number | null>> | null | undefined,
  position: string | null | undefined
): number | null {
  if (!attrs) return null;
  const values = getPositionAttrKeys(position)
    .map((key) => attrs[key])
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * The six attributes that have existed since the original schema (migration
 * 001). They are NOT NULL with a default, so they are always safe to read and
 * write.
 */
export const CORE_ATTR_KEYS: AttrKey[] = [
  "pace", "shooting", "passing", "dribbling", "defending", "physical",
];

/**
 * Everything added by migration 013. Nullable — and absent from the table
 * entirely on a project where that migration was never applied, which is the
 * failure mode `isMissingAttributeColumn` below detects.
 */
export const EXTENDED_ATTR_KEYS: AttrKey[] = ALL_ATTR_KEYS.filter(
  (key) => !CORE_ATTR_KEYS.includes(key)
);

/**
 * Column lists for `.select()`. Spelled out as literals rather than joined from
 * the key arrays because supabase-js parses the select string in the *type*
 * system — a runtime `.join()` erases to `string` and collapses the whole
 * query's inferred row type to a ParserError. `attributes.test.ts` asserts
 * these stay in step with the key arrays, so the duplication cannot drift.
 */
export const ALL_ATTR_SELECT =
  "pace, shooting, passing, dribbling, defending, physical, ball_control, crossing, heading, tackling, finishing, first_touch, stamina, agility, jumping, strength, positioning, decision_making, composure, work_rate, leadership, shot_stopping, reflexes, distribution, handling, marking, pressing, off_ball_movement, game_reading, communication";

export const CORE_ATTR_SELECT =
  "pace, shooting, passing, dribbling, defending, physical";

/**
 * True when a Supabase error means the expanded attribute columns are missing
 * from the live database, or exist but aren't in PostgREST's schema cache.
 *
 * `PGRST204` is PostgREST's write-side "Could not find the 'X' column of
 * 'player_attributes' in the schema cache"; `42703` is Postgres' own
 * undefined_column, which a wide SELECT raises. Both mean the same thing here:
 * `supabase/migrations/030_repair_expanded_attributes.sql` has not been run.
 */
export function isMissingAttributeColumn(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

/**
 * Shown to a coach whose assessment only partially saved because of the above.
 * Names the remedy, since the coach can't apply a migration themselves.
 */
export const MISSING_ATTR_COLUMNS_MESSAGE =
  "Saved the six core attributes only. The expanded attributes could not be " +
  "saved because this database is missing those columns — an administrator " +
  "needs to run the pending migration (030_repair_expanded_attributes.sql).";
