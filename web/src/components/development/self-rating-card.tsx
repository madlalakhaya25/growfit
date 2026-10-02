"use client";
import { useState, useTransition } from "react";
import { Frown, Meh, Smile, Laugh, PartyPopper, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveSelfAssessment } from "@/app/actions/self-assessment";
import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_META, type MilestoneCategory } from "@/lib/development-categories";
import { SELF_RATINGS, SELF_RATING_LABELS, usesFaces, type SelfRating } from "@/lib/self-assessment";

const FACES: Record<SelfRating, LucideIcon> = { 1: Frown, 2: Meh, 3: Smile, 4: Laugh, 5: PartyPopper };

interface Props {
  termId: string;
  termName: string;
  ageGroup: string | null;
  initial: Partial<Record<MilestoneCategory, SelfRating>>;
}

/** The player's own view of themself: five questions, no right answer. Only they and their coach see it. */
export function SelfRatingCard({ termId, termName, ageGroup, initial }: Readonly<Props>) {
  const [ratings, setRatings] = useState(initial);
  const [, startTransition] = useTransition();
  const faces = usesFaces(ageGroup);

  function pick(category: MilestoneCategory, rating: SelfRating) {
    const before = ratings[category];
    setRatings((r) => ({ ...r, [category]: rating }));
    startTransition(async () => {
      const res = await saveSelfAssessment(termId, category, rating);
      if (res?.error) {
        setRatings((r) => {
          const next = { ...r };
          if (before) next[category] = before;
          else delete next[category];
          return next;
        });
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">How do you think you&apos;re doing? {termName}</h2>
        <p className="text-sm text-muted-foreground">
          There are no right answers. Only you and your coach can see this, and it helps you talk about it together.
        </p>
      </div>
      <div className="space-y-4">
        {MILESTONE_CATEGORIES.map((category) => {
          const meta = MILESTONE_CATEGORY_META[category];
          return (
            <fieldset key={category} className="m-0 min-w-0 space-y-2 border-0 p-0">
              <legend className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", meta.chip)}>
                <meta.Icon className="size-3.5" aria-hidden="true" />
                {meta.label}
              </legend>
              <div className="grid grid-cols-5 gap-1.5">
                {SELF_RATINGS.map((rating) => {
                  const Face = FACES[rating];
                  return (
                    <button
                      key={rating}
                      type="button"
                      aria-pressed={ratings[category] === rating}
                      aria-label={SELF_RATING_LABELS[rating]}
                      onClick={() => pick(category, rating)}
                      className={cn(
                        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-xs font-medium transition-colors",
                        ratings[category] === rating
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {faces ? <Face className="size-6" aria-hidden="true" /> : <span className="text-base">{rating}</span>}
                      <span className="hidden sm:block">{SELF_RATING_LABELS[rating]}</span>
                    </button>
                  );
                })}
              </div>
              {ratings[category] && (
                <p className="text-sm text-muted-foreground">{SELF_RATING_LABELS[ratings[category] as SelfRating]}</p>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
