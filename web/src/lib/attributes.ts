export type AttrKey =
  | "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical"
  | "ball_control" | "crossing" | "heading" | "tackling" | "finishing" | "first_touch"
  | "stamina" | "agility" | "jumping" | "strength"
  | "positioning" | "decision_making" | "composure" | "work_rate" | "leadership"
  | "shot_stopping" | "reflexes" | "distribution" | "handling";

export type AttrCategory = "technical" | "physical" | "mental";

export const ATTR_META: Record<AttrKey, { label: string; category: AttrCategory; color: string }> = {
  pace:            { label: "Pace",             category: "physical",  color: "bg-sky-500" },
  shooting:        { label: "Shooting",         category: "technical", color: "bg-orange-500" },
  passing:         { label: "Passing",          category: "technical", color: "bg-emerald-500" },
  dribbling:       { label: "Dribbling",        category: "technical", color: "bg-violet-500" },
  defending:       { label: "Defending",        category: "technical", color: "bg-blue-500" },
  physical:        { label: "Strength",         category: "physical",  color: "bg-rose-500" },
  ball_control:    { label: "Ball Control",     category: "technical", color: "bg-violet-400" },
  crossing:        { label: "Crossing",         category: "technical", color: "bg-teal-500" },
  heading:         { label: "Heading",          category: "technical", color: "bg-indigo-500" },
  tackling:        { label: "Tackling",         category: "technical", color: "bg-blue-600" },
  finishing:       { label: "Finishing",        category: "technical", color: "bg-red-500" },
  first_touch:     { label: "First Touch",      category: "technical", color: "bg-lime-500" },
  stamina:         { label: "Stamina",          category: "physical",  color: "bg-amber-500" },
  agility:         { label: "Agility",          category: "physical",  color: "bg-cyan-500" },
  jumping:         { label: "Jumping",          category: "physical",  color: "bg-purple-500" },
  strength:        { label: "Strength",         category: "physical",  color: "bg-rose-600" },
  positioning:     { label: "Positioning",      category: "mental",    color: "bg-blue-400" },
  decision_making: { label: "Decision Making",  category: "mental",    color: "bg-green-500" },
  composure:       { label: "Composure",        category: "mental",    color: "bg-teal-400" },
  work_rate:       { label: "Work Rate",        category: "mental",    color: "bg-orange-400" },
  leadership:      { label: "Leadership",       category: "mental",    color: "bg-yellow-500" },
  shot_stopping:   { label: "Shot Stopping",    category: "technical", color: "bg-red-600" },
  reflexes:        { label: "Reflexes",         category: "technical", color: "bg-pink-500" },
  distribution:    { label: "Distribution",     category: "technical", color: "bg-emerald-600" },
  handling:        { label: "Handling",         category: "technical", color: "bg-indigo-400" },
};

export type PositionAttrSet = { technical: AttrKey[]; physical: AttrKey[]; mental: AttrKey[] };

const GK_ATTRS: PositionAttrSet = {
  technical: ["shot_stopping", "reflexes", "distribution", "handling"],
  physical:  ["agility", "pace", "jumping", "strength"],
  mental:    ["composure", "positioning", "decision_making", "leadership"],
};
const CB_ATTRS: PositionAttrSet = {
  technical: ["tackling", "heading", "passing", "ball_control"],
  physical:  ["pace", "strength", "jumping", "stamina"],
  mental:    ["positioning", "decision_making", "composure", "leadership"],
};
const FULLBACK_ATTRS: PositionAttrSet = {
  technical: ["crossing", "tackling", "passing", "dribbling"],
  physical:  ["pace", "stamina", "agility", "strength"],
  mental:    ["positioning", "work_rate", "decision_making", "composure"],
};
const WINGBACK_ATTRS: PositionAttrSet = {
  technical: ["crossing", "dribbling", "passing", "tackling", "finishing"],
  physical:  ["pace", "stamina", "agility", "strength"],
  mental:    ["work_rate", "positioning", "decision_making", "composure"],
};
const CDM_ATTRS: PositionAttrSet = {
  technical: ["tackling", "passing", "ball_control", "heading"],
  physical:  ["strength", "stamina", "pace", "agility"],
  mental:    ["positioning", "work_rate", "decision_making", "composure"],
};
const CM_ATTRS: PositionAttrSet = {
  technical: ["passing", "ball_control", "shooting", "tackling", "first_touch"],
  physical:  ["stamina", "pace", "agility", "strength"],
  mental:    ["decision_making", "positioning", "work_rate", "composure"],
};
const WIDE_MID_ATTRS: PositionAttrSet = {
  technical: ["passing", "dribbling", "crossing", "shooting", "first_touch"],
  physical:  ["pace", "stamina", "agility", "strength"],
  mental:    ["work_rate", "decision_making", "composure", "positioning"],
};
const CAM_ATTRS: PositionAttrSet = {
  technical: ["passing", "dribbling", "shooting", "ball_control", "first_touch", "crossing"],
  physical:  ["pace", "agility", "stamina"],
  mental:    ["decision_making", "composure", "work_rate", "positioning"],
};
const WINGER_ATTRS: PositionAttrSet = {
  technical: ["dribbling", "crossing", "finishing", "ball_control", "first_touch"],
  physical:  ["pace", "agility", "stamina", "strength"],
  mental:    ["decision_making", "work_rate", "composure", "positioning"],
};
const STRIKER_ATTRS: PositionAttrSet = {
  technical: ["finishing", "heading", "ball_control", "dribbling", "shooting"],
  physical:  ["pace", "strength", "jumping", "agility", "stamina"],
  mental:    ["positioning", "composure", "decision_making", "work_rate"],
};
const SS_ATTRS: PositionAttrSet = {
  technical: ["finishing", "passing", "dribbling", "ball_control", "first_touch"],
  physical:  ["pace", "agility", "stamina", "strength"],
  mental:    ["positioning", "composure", "decision_making", "work_rate"],
};
const DEFAULT_ATTRS: PositionAttrSet = {
  technical: ["passing", "shooting", "dribbling", "ball_control", "first_touch"],
  physical:  ["pace", "stamina", "agility", "strength"],
  mental:    ["positioning", "decision_making", "composure", "work_rate"],
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

/** Column list for a `.select()` covering every attribute. */
export const ALL_ATTR_SELECT = ALL_ATTR_KEYS.join(", ");

/** Column list for a `.select()` covering only the always-present six. */
export const CORE_ATTR_SELECT = CORE_ATTR_KEYS.join(", ");

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
