"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleMilestoneCompletion } from "@/app/actions/development";
import { MILESTONE_CATEGORY_META, type MilestoneCategory } from "@/lib/development-categories";

type Props = {
  templateId: string;
  playerId: string;
  season: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  initialCompleted: boolean;
  initialNote?: string | null;
};

export function MilestoneCard({
  templateId,
  playerId,
  season,
  title,
  description,
  category,
  initialCompleted,
  initialNote,
}: Props) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [note, setNote] = useState(initialNote ?? "");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const meta = MILESTONE_CATEGORY_META[category];

  function handleToggle() {
    const next = !completed;
    if (next) {
      setShowNote(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await toggleMilestoneCompletion(templateId, playerId, season, false);
      if (res?.error) { setError(res.error); toast.error(res.error); return; }
      setCompleted(false);
      setNote("");
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await toggleMilestoneCompletion(templateId, playerId, season, true, note || undefined);
      if (res?.error) { setError(res.error); toast.error(res.error); return; }
      setCompleted(true);
      setShowNote(false);
    });
  }

  function handleCancel() {
    setShowNote(false);
    setNote(initialNote ?? "");
  }

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
      {/* A completed box takes the category's solid fill and a background-coloured
          tick. The old version set background AND border to currentColor while
          the tick was also currentColor-derived, so the tick vanished into it.
          One bg-* class at a time -- never two on the same element. */}
      <button
        type="button"
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
        aria-pressed={completed}
        disabled={isPending}
        onClick={handleToggle}
        className={`mt-0.5 grid size-5 flex-shrink-0 place-items-center rounded border-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          completed ? `${meta.fill} border-transparent` : "border-border"
        }`}
      >
        {completed && (
          <svg viewBox="0 0 12 12" className="size-3.5 text-background" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-snug ${completed ? "line-through text-muted-foreground" : ""}`}>
            {title}
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{description}</p>

        {showNote && (
          <div className="space-y-2 pt-1">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Add a note (optional)"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {completed && initialNote && !showNote && (
          <p className="text-xs text-muted-foreground italic">{initialNote}</p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
