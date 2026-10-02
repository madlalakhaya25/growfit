"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { rewriteForAge, type AgeRewriteResult } from "@/app/actions/age-rewrite";

/**
 * "Simplify for U11s": shows a rewrite of the coach's message for the team's
 * age, and only replaces the message if the coach chooses to use it. Nothing is
 * sent from here. The coach's own words are never overwritten silently, and a
 * figure the rewrite dropped (a time, a date) is called out before they decide.
 */
export function SimplifyForAge({
  ageGroup,
  getText,
  onUse,
}: {
  /** The team's age group, e.g. "U11". Hidden when there isn't one. */
  ageGroup: string | null;
  getText: () => string;
  onUse: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgeRewriteResult | null>(null);

  if (!ageGroup) return null;

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await rewriteForAge({ text: getText(), ageGroup: ageGroup! });
    setBusy(false);
    setResult(res);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Wand2 className="size-3 text-primary" aria-hidden="true" />}
        Simplify for {ageGroup}
      </button>

      {result?.error && <p role="alert" className="text-xs text-destructive">{result.error}</p>}

      {result?.text && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Simpler version for {ageGroup}</p>
          <p className="whitespace-pre-wrap text-sm">{result.text}</p>
          {result.missing && result.missing.length > 0 && (
            <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
              Check these from your message, they are not in this version: {result.missing.join(", ")}.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { onUse(result.text!); setResult(null); }}
              className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              Use this version
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
