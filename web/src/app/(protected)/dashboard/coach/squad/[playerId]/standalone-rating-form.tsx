"use client";
import { useState, useTransition } from "react";
import { Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { addStandaloneRating } from "@/app/actions/ratings";

export function StandaloneRatingForm({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(3);
  const [hovered, setHovered] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setRating(3);
    setHovered(0);
    setNote("");
    setError("");
    setOpen(false);
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await addStandaloneRating(playerId, { rating, note });
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success("Rating saved.");
        reset();
      }
    });
  }

  const displayRating = hovered || rating;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="size-4" />
        Add standalone rating
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">New rating</p>
        <button
          onClick={reset}
          aria-label="Cancel"
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        className="flex gap-1"
        onMouseLeave={() => setHovered(0)}
        role="group"
        aria-label="Rating"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n !== 1 ? "s" : ""}`}
            onMouseEnter={() => setHovered(n)}
            onClick={() => setRating(n)}
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={`size-6 transition-colors ${
                n <= displayRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 self-center text-sm text-muted-foreground">{rating}/5</span>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Coach note (optional)"
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save rating"}
        </button>
      </div>
    </div>
  );
}
