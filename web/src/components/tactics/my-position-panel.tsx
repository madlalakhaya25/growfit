"use client";

import { useState, useTransition } from "react";
import { UserCircle, Play, Lightbulb } from "lucide-react";
import { conceptsForPositionGroup, youtubeSearchUrl } from "@/lib/tactics";
import { explainPositionalRole } from "@/app/actions/tactics";

/**
 * Player-facing "what does my position do" guide. Unlike the coach panel this
 * is locked to the player's own position and age group — no pickers, no session
 * generator — so it reads as guidance about them rather than a coaching tool.
 */
export function MyPositionPanel({
  positionLabel,
  positionGroup,
  ageGroup,
}: {
  positionLabel: string;
  positionGroup: string;
  ageGroup: string;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const concepts = conceptsForPositionGroup(positionGroup).slice(0, 4);

  function run() {
    setError(null);
    start(async () => {
      const res = await explainPositionalRole({ positionLabel, ageGroup });
      if (res.error) setError(res.error);
      else setExplanation(res.explanation ?? null);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <UserCircle className="size-4 text-primary shrink-0" aria-hidden="true" />
        <p className="font-semibold text-sm">My position: {positionLabel}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          What your position is responsible for, in and out of possession — written for {ageGroup}.
        </p>

        {!explanation && (
          <button
            type="button"
            onClick={run}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Lightbulb className="size-3.5" aria-hidden="true" />
            {isPending ? "Loading…" : "Show my role"}
          </button>
        )}

        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
            Working out what your position needs…
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {explanation && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-1">
            {explanation.trim().split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
            ))}
          </div>
        )}

        {concepts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Learn the ideas that matter for you
            </p>
            <div className="flex flex-col gap-2">
              {concepts.map((c) => (
                <div key={c.id} className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.summary}</p>
                  <a
                    href={youtubeSearchUrl(c.searchQueries[0])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Play className="size-3" aria-hidden="true" /> Watch how it works
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
