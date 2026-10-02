"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rateSessionEffort } from "@/app/actions/session-effort";
import { EFFORT_LEVELS, effortLabel } from "@/lib/session-effort";
import { cn } from "@/lib/utils";

/**
 * One tap after training: how hard was it for the squad. It sets the same value
 * for everyone who came, because the readiness figure needs a rough load, not a
 * number per child at the touchline. Private to coaches.
 */
export function SessionEffort({ sessionId, initialRpe }: Readonly<{ sessionId: string; initialRpe: number | null }>) {
  const [rpe, setRpe] = useState(initialRpe);
  const [pending, start] = useTransition();

  function pick(value: number) {
    const before = rpe;
    setRpe(value);
    start(async () => {
      const res = await rateSessionEffort(sessionId, value);
      if (res.error) {
        setRpe(before);
        toast.error(res.error);
        return;
      }
      toast.success(res.count ? `Saved for ${res.count} ${res.count === 1 ? "child" : "children"}.` : "Mark who came first, then rate it again.");
    });
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">How hard was it?</h2>
        <p className="text-xs text-muted-foreground">
          One tap for everyone who came. It helps spot a child being pushed too hard before they get hurt.
          {rpe !== null && ` Now: ${effortLabel(rpe)}.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Session effort">
        {EFFORT_LEVELS.map((l) => (
          <button
            key={l.rpe}
            type="button"
            disabled={pending}
            aria-pressed={rpe === l.rpe}
            onClick={() => pick(l.rpe)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
              rpe === l.rpe ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
    </section>
  );
}
