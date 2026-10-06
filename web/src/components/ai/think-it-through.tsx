"use client";

import { useState } from "react";
import { Loader2, Lightbulb } from "lucide-react";
import { thinkItThrough, type CopilotResult } from "@/app/actions/copilot";

/**
 * "Think it through": helps the coach reason about the problem they just named.
 * The answer is a draft for them alone; it is not saved and goes to nobody.
 */
export function ThinkItThrough({ problem, ageGroup }: Readonly<{ problem: string; ageGroup: string | null }>) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CopilotResult | null>(null);
  const ready = problem.trim().length > 0;

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await thinkItThrough({ problem, ageGroup });
    setBusy(false);
    setResult(res);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || !ready}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs hover:bg-muted disabled:opacity-50 pointer-coarse:h-11"
      >
        {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Lightbulb className="size-3 text-primary" aria-hidden="true" />}
        Think it through
      </button>
      {!ready && <p className="text-xs text-muted-foreground">Name the problem above first.</p>}

      {result?.error && <p role="alert" className="text-xs text-destructive">{result.error}</p>}

      {result?.sections && (
        <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            A draft to help you think. Check it against what you saw. It is not shared with anyone.
          </p>
          {result.sections.map((s) => (
            <div key={s.key}>
              <p className="text-xs font-semibold">{s.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{s.body}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
