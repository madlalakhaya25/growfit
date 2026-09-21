"use client";
import { useState, useTransition } from "react";
import { Check, Star, Zap } from "lucide-react";
import { upsertPlayerAttributes } from "@/app/actions/attributes";
import { addStandaloneRating } from "@/app/actions/ratings";
import {
  getPositionAttrs,
  getPositionAttrKeys,
  getQuickAssessKeys,
  ATTR_CATEGORIES,
  ATTR_META,
  ALL_ATTR_KEYS,
  CATEGORY_LABELS,
  type AttrKey,
} from "@/lib/attributes";
import { cn } from "@/lib/utils";

interface Props {
  playerId: string;
  initial: Partial<Record<AttrKey, number | null>> | null;
  position?: string | null;
  /**
   * The squad's median rating for each of this position's quick-assess
   * attributes (docs/BACKLOG.md 2.6), shown as a tick mark on each slider
   * so a coach can see how this player compares while dragging, rather
   * than guessing in a vacuum. Only ever has entries for attributes at
   * least one squad-mate has actually been assessed on.
   */
  squadMedians?: Partial<Record<AttrKey, number>>;
}

function buildDefaults(
  initial: Partial<Record<AttrKey, number | null>> | null
): Record<AttrKey, number> {
  const defaults = {} as Record<AttrKey, number>;
  for (const key of ALL_ATTR_KEYS) {
    defaults[key] = initial?.[key] ?? 50;
  }
  return defaults;
}

const SLIDER_MIN = 1;
const SLIDER_MAX = 99;

export function PlayerAttributesForm({ playerId, initial, position, squadMedians }: Props) {
  const [values, setValues] = useState<Record<AttrKey, number>>(() => buildDefaults(initial));
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingHovered, setRatingHovered] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [saved, setSaved] = useState(false);
  const [quickAssess, setQuickAssess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const posAttrs = getPositionAttrs(position);
  // Exactly what this form renders — and so exactly what it is entitled to save.
  const shownKeys = getPositionAttrKeys(position);
  const quickKeys = getQuickAssessKeys(position);

  function handleChange(key: AttrKey, value: number) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function groupAvg(keys: AttrKey[]): number {
    if (keys.length === 0) return 0;
    return Math.round(keys.reduce((sum, k) => sum + values[k], 0) / keys.length);
  }

  function handleSubmit() {
    setError("");
    setWarning("");
    setSaved(false);
    startTransition(async () => {
      // Quick assess only shows five sliders, and only those five should be
      // written — the save action's own upsert only touches named columns
      // precisely so an attribute the coach was never shown doesn't get a
      // fabricated "50" (see upsertPlayerAttributes's comment). Submitting
      // the full `shownKeys` set here regardless of the toggle would defeat
      // that on a player's very first assessment, where every unshown
      // attribute still defaults to 50 rather than a prior real value.
      const keysToSave = quickAssess ? quickKeys : shownKeys;
      const assessed: Partial<Record<AttrKey, number>> = {};
      for (const key of keysToSave) assessed[key] = values[key];

      const [attrsResult, ratingResult] = await Promise.all([
        upsertPlayerAttributes(playerId, { ...assessed, notes: notes || undefined }),
        rating > 0 ? addStandaloneRating(playerId, { rating, note: notes || undefined }) : Promise.resolve(null),
      ]);
      const err = attrsResult?.error ?? ratingResult?.error;
      if (err) {
        setError(err);
      } else {
        setSaved(true);
        if (attrsResult?.warning) setWarning(attrsResult.warning);
        if (rating > 0) setRating(0);
      }
    });
  }

  // Five corners, matching the milestone categories. A position with nothing
  // in a corner (most outfield players have no leadership attributes) simply
  // does not show that group.
  const GROUPS: { label: string; keys: AttrKey[] }[] = ATTR_CATEGORIES
    .map((category) => ({ label: CATEGORY_LABELS[category], keys: posAttrs[category] }))
    .filter((group) => group.keys.length > 0);

  const displayRating = ratingHovered || rating;

  function renderAttrRow(key: AttrKey) {
    const meta = ATTR_META[key];
    const median = squadMedians?.[key];
    const medianPct = median != null ? ((median - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100 : null;
    return (
      <div key={key} className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{meta.label}</span>
          <span className="tabular-nums text-muted-foreground w-8 text-right">{values[key]}</span>
        </div>
        <div className="relative flex items-center gap-2">
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            value={values[key]}
            onChange={(e) => handleChange(key, Number(e.target.value))}
            aria-label={meta.label}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
            style={{ accentColor: "var(--color-primary)" }}
          />
          {medianPct !== null && (
            <div
              className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50"
              style={{ left: `${medianPct}%` }}
              title={`Squad median: ${median}`}
            />
          )}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${meta.color}`}
            style={{ width: `${values[key]}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall rating */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Overall rating (optional)
        </p>
        <div
          className="flex gap-1"
          onMouseLeave={() => setRatingHovered(0)}
          role="group"
          aria-label="Overall rating"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n !== 1 ? "s" : ""}`}
              onMouseEnter={() => setRatingHovered(n)}
              onClick={() => setRating((prev) => (prev === n ? 0 : n))}
              className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star
                className={`size-6 transition-colors ${
                  n <= displayRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30 hover:text-amber-300"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 self-center text-sm text-muted-foreground">{rating}/5</span>
          )}
          {rating === 0 && (
            <span className="ml-2 self-center text-xs text-muted-foreground">click to rate</span>
          )}
        </div>
      </div>

      {/* Quick assess toggle — fifteen players after training is 450 slider
          decisions on the full form; this shows only the five attributes
          that matter most for this position, with a squad median tick on
          each so a snap judgement still has a reference point. */}
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Zap className="size-4 text-primary" aria-hidden="true" />
          Quick assess
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={quickAssess}
          onClick={() => setQuickAssess((v) => !v)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            quickAssess ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform",
              quickAssess ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {quickAssess ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The {quickKeys.length} attributes that matter most for this position. The tick on each
            slider is the squad&apos;s median.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickKeys.map((key) => renderAttrRow(key))}
          </div>
        </div>
      ) : (
        GROUPS.map(({ label, keys }) => {
          const avg = groupAvg(keys);
          return (
            <div key={label} className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                  {avg}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {keys.map((key) => renderAttrRow(key))}
              </div>
            </div>
          );
        })
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Assessment notes (optional)"
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      {warning && <p className="text-xs text-amber-600">{warning}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save assessment"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
