"use client";

import { KIT_OPTIONS, SPACE_OPTIONS, type KitValue, type SpaceValue } from "@/lib/session-constraints";

/**
 * Space and kit for the session generator (the player count and minutes are
 * already fields on both forms). "Not specified" for space and no kit ticked
 * mean different things: the first tells the model nothing, a ticked kit list
 * tells it to use only that, so the kit list starts out unspecified until the
 * coach says what they have.
 */
export function SessionConstraintFields({
  idPrefix,
  space,
  onSpace,
  kit,
  onKit,
}: Readonly<{
  idPrefix: string;
  space: SpaceValue | "";
  onSpace: (v: SpaceValue | "") => void;
  /** null = the coach hasn't said what kit they have. */
  kit: KitValue[] | null;
  onKit: (v: KitValue[] | null) => void;
}>) {
  const toggle = (k: KitValue, on: boolean) => {
    const current = kit ?? [];
    onKit(on ? [...current, k] : current.filter((x) => x !== k));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-space`} className="text-xs font-medium text-muted-foreground">
          Space
        </label>
        <select
          id={`${idPrefix}-space`}
          value={space}
          onChange={(e) => onSpace(e.target.value as SpaceValue | "")}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Not specified</option>
          {SPACE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-muted-foreground">
          Kit you have {kit === null && <span className="font-normal">(tick to limit the session to it)</span>}
        </legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {KIT_OPTIONS.map((k) => (
            <label key={k.value} className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={kit?.includes(k.value) ?? false}
                onChange={(e) => toggle(k.value, e.target.checked)}
              />
              {k.label}
            </label>
          ))}
        </div>
        {kit !== null && (
          <button
            type="button"
            onClick={() => onKit(null)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Don&apos;t limit the kit
          </button>
        )}
      </fieldset>
    </div>
  );
}
