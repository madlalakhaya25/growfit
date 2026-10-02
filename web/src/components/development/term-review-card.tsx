"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveTermReview } from "@/app/actions/term-review";
import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_META, type MilestoneCategory } from "@/lib/development-categories";
import {
  BANDS, BAND_LABELS, BAND_DESCRIPTIONS_APPROVED, describeBand, type Band,
} from "@/lib/term-review";

type BandMap = Partial<Record<MilestoneCategory, Band>>;

interface Props {
  playerId: string;
  termId: string;
  termName: string;
  ageGroup: string | null;
  initial: BandMap;
  last: BandMap;
  lastTermName: string | null;
}

export function TermReviewCard({ playerId, termId, termName, ageGroup, initial, last, lastTermName }: Readonly<Props>) {
  const [bands, setBands] = useState<BandMap>(initial);
  const [, startTransition] = useTransition();

  function pick(category: MilestoneCategory, band: Band) {
    const before = bands[category];
    setBands((b) => ({ ...b, [category]: band }));
    startTransition(async () => {
      const res = await saveTermReview(playerId, termId, category, band);
      if (res?.error) {
        setBands((b) => {
          const next = { ...b };
          if (before) next[category] = before;
          else delete next[category];
          return next;
        });
        toast.error(res.error);
      }
    });
  }

  const done = MILESTONE_CATEGORIES.filter((c) => bands[c]).length;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Term review: {termName}</h2>
          <span className="text-sm text-muted-foreground">{done} of {MILESTONE_CATEGORIES.length} done</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Where is this player in each area? Families see how they have grown since last term, never a score.
        </p>
        {!BAND_DESCRIPTIONS_APPROVED && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            The wording under each band is a draft, waiting for the technical director to approve it.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {MILESTONE_CATEGORIES.map((category) => {
          const meta = MILESTONE_CATEGORY_META[category];
          const chosen = bands[category];
          const before = last[category];
          return (
            <div key={category} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.chip)}>
                  <meta.Icon className="size-3.5" aria-hidden="true" />
                  {meta.label}
                </span>
                {before && lastTermName && (
                  <span className="text-xs text-muted-foreground">{lastTermName}: {BAND_LABELS[before]}</span>
                )}
              </div>
              <div role="group" aria-label={`${meta.label} band`} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {BANDS.map((band) => (
                  <button
                    key={band}
                    type="button"
                    aria-pressed={chosen === band}
                    onClick={() => pick(category, band)}
                    className={cn(
                      "min-h-11 rounded-md border px-2 text-sm font-medium transition-colors sm:min-h-9",
                      chosen === band
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {BAND_LABELS[band]}
                  </button>
                ))}
              </div>
              {chosen && (
                <p className="text-sm text-muted-foreground">{describeBand(category, ageGroup, chosen)}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
