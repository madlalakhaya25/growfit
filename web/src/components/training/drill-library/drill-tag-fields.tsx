import { LIBRARY_AGE_GROUPS, DRILL_THEMES, FOUR_CORNERS, MAX_COACHING_POINTS, MAX_EQUIPMENT, MAX_PLAYERS } from "@/lib/drill-library";

const inputCls =
  "flex h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface DrillTagDefaults {
  age_groups?: readonly string[];
  themes?: readonly string[];
  four_corner?: string | null;
  players_needed?: number | null;
  equipment?: string | null;
  coaching_points?: string | null;
  tactic_play_id?: string | null;
}

/** A checkbox that looks like an iOS filter chip; submits like any checkbox. */
function ChipCheckbox({ name, value, label, defaultChecked }: Readonly<{ name: string; value: string; label: string; defaultChecked: boolean }>) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        {label}
      </span>
    </label>
  );
}

function ChipFieldset({ legend, name, options, selected }: Readonly<{
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
}>) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-2">
        {options.map((o) => (
          <ChipCheckbox key={o.value} name={name} value={o.value} label={o.label} defaultChecked={selected.includes(o.value)} />
        ))}
      </div>
    </fieldset>
  );
}

const AGE_OPTIONS = LIBRARY_AGE_GROUPS.map((a) => ({ value: a, label: a }));

/**
 * The academy-library tags (migration 065), shared by the add, edit and
 * "Share to library" forms. `compact` keeps only the tags a coach chooses when
 * sharing from a session: who it is for and what it trains.
 */
export function DrillTagFields({
  idPrefix,
  defaults = {},
  plays = [],
  compact = false,
}: Readonly<{
  idPrefix: string;
  defaults?: DrillTagDefaults;
  plays?: readonly { id: string; name: string }[];
  compact?: boolean;
}>) {
  return (
    <div className="space-y-4">
      <ChipFieldset legend="Age groups" name="age_groups" options={AGE_OPTIONS} selected={defaults.age_groups ?? []} />
      <ChipFieldset legend="Themes" name="themes" options={DRILL_THEMES} selected={defaults.themes ?? []} />

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-corner`} className="text-sm font-medium">4-corner focus</label>
        <select id={`${idPrefix}-corner`} name="four_corner" defaultValue={defaults.four_corner ?? ""} className={inputCls}>
          <option value="">Not set</option>
          {FOUR_CORNERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-players`} className="text-sm font-medium">Players needed</label>
              <input id={`${idPrefix}-players`} name="players_needed" type="number" min={1} max={MAX_PLAYERS}
                defaultValue={defaults.players_needed ?? ""} placeholder="e.g. 8" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-play`} className="text-sm font-medium">Diagram</label>
              <select id={`${idPrefix}-play`} name="tactic_play_id" defaultValue={defaults.tactic_play_id ?? ""} className={inputCls}>
                <option value="">No diagram</option>
                {plays.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-equipment`} className="text-sm font-medium">Equipment</label>
            <input id={`${idPrefix}-equipment`} name="equipment" maxLength={MAX_EQUIPMENT}
              defaultValue={defaults.equipment ?? ""} placeholder="e.g. 8 cones, 4 bibs, 6 balls" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-points`} className="text-sm font-medium">Coaching points</label>
            <textarea id={`${idPrefix}-points`} name="coaching_points" rows={3} maxLength={MAX_COACHING_POINTS}
              defaultValue={defaults.coaching_points ?? ""} placeholder="What you say again and again: open body shape, check your shoulder…"
              className="flex w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </>
      )}
    </div>
  );
}
