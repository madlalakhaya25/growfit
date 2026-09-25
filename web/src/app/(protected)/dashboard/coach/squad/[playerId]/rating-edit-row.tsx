"use client";
import { useState, useTransition } from "react";
import { Star, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateRating, deleteRating } from "@/app/actions/ratings";
import { formatDayMonthYear } from "@/lib/time";

interface Props {
  ratingId: string;
  playerId: string;
  initialRating: number;
  initialNote: string | null;
  opponent: string | null;
  date: string;
}

export function RatingEditRow({
  ratingId,
  playerId,
  initialRating,
  initialNote,
  opponent,
  date,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState(0);
  const [note, setNote] = useState(initialNote ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetEdit() {
    setRating(initialRating);
    setNote(initialNote ?? "");
    setError("");
    setMode("view");
  }

  function handleSave() {
    setError("");
    startTransition(async () => {
      const result = await updateRating(ratingId, playerId, { rating, note });
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setMode("view");
      }
    });
  }

  function handleDelete() {
    setError("");
    startTransition(async () => {
      const result = await deleteRating(ratingId, playerId);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setMode("view");
      }
      // on success the row is removed by revalidatePath — no state update needed
    });
  }

  const displayRating = hovered || rating;

  if (mode === "view") {
    return (
      <div className="group flex items-start gap-4 px-4 py-3">
        <div className="flex shrink-0 gap-0.5 pt-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`size-4 ${n <= initialRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          {opponent && <p className="text-sm font-medium">vs {opponent}</p>}
          {initialNote && (
            <p className="mt-0.5 text-sm text-muted-foreground">&ldquo;{initialNote}&rdquo;</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDayMonthYear(date)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setMode("edit")}
            aria-label="Edit rating"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => setMode("confirm-delete")}
            aria-label="Delete rating"
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (mode === "confirm-delete") {
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="text-sm text-muted-foreground">Delete this rating?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("view")}
            disabled={isPending}
            className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    );
  }

  // edit mode
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex gap-0.5"
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
                className={`size-5 transition-colors ${
                  n <= displayRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{rating}/5</span>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="Coach note (optional)"
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex items-center justify-between">
        {error ? <p className="text-xs text-destructive">{error}</p> : <span />}
        <div className="flex gap-2">
          <button
            onClick={resetEdit}
            disabled={isPending}
            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <X className="size-3" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <Check className="size-3" />
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
