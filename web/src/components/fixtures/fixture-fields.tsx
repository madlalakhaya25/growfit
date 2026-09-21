"use client";

/**
 * The fixture form's fields, shared by "new fixture" and "edit fixture".
 *
 * Both write through `createFixtureSchema`, so the two forms must offer
 * exactly the same fields with the same names — a field present on one and
 * missing from the other silently blanks that column on save. Defining them
 * once is the only way that stays true.
 */

function Field({
  label,
  name,
  required,
  placeholder,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

export interface FixtureDefaults {
  opponent?: string;
  venue?: string | null;
  /** Local `datetime-local` value, i.e. `YYYY-MM-DDTHH:mm`. */
  fixtureDate?: string;
  isHome?: boolean;
  notes?: string | null;
}

export function FixtureFields({ defaults }: { defaults?: FixtureDefaults }) {
  const isHome = defaults?.isHome ?? true;

  return (
    <>
      <Field
        label="Opponent *"
        name="opponent"
        required
        placeholder="e.g. Sundowns Academy"
        defaultValue={defaults?.opponent}
      />
      <Field
        label="Venue"
        name="venue"
        placeholder="e.g. FNB Stadium"
        defaultValue={defaults?.venue ?? undefined}
      />
      <Field
        label="Date & time *"
        name="fixture_date"
        type="datetime-local"
        required
        defaultValue={defaults?.fixtureDate}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Location</span>
        <div className="flex gap-4">
          {([["true", "Home"], ["false", "Away"]] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="is_home"
                value={val}
                defaultChecked={val === String(isHome)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          defaultValue={defaults?.notes ?? undefined}
          placeholder="Optional notes for the squad…"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
    </>
  );
}

/**
 * A stored timestamp as a `datetime-local` input value.
 *
 * `toISOString()` would be wrong here: it converts to UTC, so a 14:00
 * kickoff in SAST (UTC+2) opens the edit form showing 12:00, and saving
 * without touching the field would walk the fixture two hours earlier every
 * time someone edited it.
 */
export function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
