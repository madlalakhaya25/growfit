"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse } from "lucide-react";
import { setPlayerAvailability } from "@/app/actions/records";
import { AVAILABILITY_STATUSES, type AvailabilityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<AvailabilityStatus, string> = {
  available: "border-border text-muted-foreground hover:border-primary/50",
  injured: "border-destructive bg-destructive/10 text-destructive",
  unavailable: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

/**
 * Lets a coach or admin record whether a player is currently available to
 * play — separate from their registration/active status. Squad selection
 * (LogResultForm, and the AI's suggestLineup/generateMatchPlan) reads this,
 * so this is the one place that fact needs to be entered for every one of
 * those surfaces to see it.
 */
export function PlayerAvailabilityControl({
  playerId,
  initialStatus,
  initialNote,
}: {
  playerId: string;
  initialStatus: AvailabilityStatus;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AvailabilityStatus>(initialStatus);
  const [note, setNote] = useState(initialNote ?? "");
  // "Injured"/"Unavailable" ask for an optional note before saving; picking
  // one just opens the note field rather than saving immediately, so a coach
  // isn't forced to save the wrong status before they can add a reason.
  const [draftStatus, setDraftStatus] = useState<AvailabilityStatus | null>(null);
  const [pending, startTransition] = useTransition();

  function selectStatus(next: AvailabilityStatus) {
    if (next === "available") {
      save("available", "");
    } else {
      setDraftStatus(next);
    }
  }

  function save(next: AvailabilityStatus, nextNote: string) {
    const previousStatus = status;
    const previousNote = note;
    setStatus(next);
    setNote(nextNote);
    startTransition(async () => {
      const res = await setPlayerAvailability(playerId, next, nextNote);
      if (res?.error) {
        setStatus(previousStatus);
        setNote(previousNote);
        toast.error(res.error);
        return;
      }
      setDraftStatus(null);
      router.refresh();
    });
  }

  const active = draftStatus ?? status;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <HeartPulse className="size-3.5" aria-hidden="true" />
        Availability
      </p>
      <div className="flex flex-wrap gap-1.5">
        {AVAILABILITY_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={pending}
            onClick={() => selectStatus(s.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              active === s.value ? STATUS_STYLE[s.value] : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {draftStatus && draftStatus !== "available" && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <input
            type="text"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. hamstring, back in 2 weeks"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => save(draftStatus, note)}
            className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setDraftStatus(null)} className="text-xs text-muted-foreground hover:underline">
            Cancel
          </button>
        </div>
      )}
      {!draftStatus && status !== "available" && note && (
        <p className="text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
