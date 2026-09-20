"use client";

import { useState, useTransition } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { generateDevelopmentPlan } from "@/app/actions/development-plan";

export function DevelopmentPlanPanel({ playerId }: { playerId: string }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateDevelopmentPlan(playerId);
      if (result.error) { setError(result.error); toast.error(result.error); }
      else setPlan(result.plan ?? null);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary shrink-0" aria-hidden="true" />
          <p className="font-semibold text-sm">Personal Development Plan</p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Target className="size-3" aria-hidden="true" />
          {isPending ? "Generating…" : plan ? "Refresh Plan" : "Generate Plan"}
        </button>
      </div>

      {!plan && !error && !isPending && (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Generate a personalised 4-week development plan based on this player's attributes, ratings, and milestone progress.
        </p>
      )}

      {isPending && (
        <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
          Building development plan…
        </div>
      )}

      {error && (
        <p className="px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {plan && (
        <div className="px-4 py-4 text-sm leading-relaxed space-y-1">
          {plan.split("\n").map((line, i) => {
            const isHeader = /^\d+\.\s+[A-Z][A-Z\s]+:/.test(line.trim());
            return isHeader ? (
              <p key={i} className="font-semibold text-foreground pt-2 first:pt-0">
                {line}
              </p>
            ) : (
              <p key={i} className="text-muted-foreground">{line}</p>
            );
          })}
        </div>
      )}
    </div>
  );
}
