"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AiProse } from "@/components/ai/ai-prose";
import { addDrills } from "@/app/actions/training";
import { packDrillDescription } from "@/lib/drill-description";
import { renderSessionPlanProse } from "@/lib/session-plan";
import type { SessionPlanStructured } from "@/app/actions/session-generator";

export interface ProgressionSession { id: string; when: string; label: string }

/**
 * A play's three-drill progression (unopposed -> opposed -> small-sided game)
 * with a choice of which of the team's sessions to add it to. Applied through
 * the same addDrills() + packDrillDescription() path as the session
 * generator, so a drill is stored exactly as a hand-made one would be.
 */
export function SessionProgression({
  plan,
  sessions,
  defaultSessionId = "",
  onApplied,
}: {
  plan: SessionPlanStructured;
  sessions: ProgressionSession[];
  defaultSessionId?: string;
  onApplied?: (message: string) => void;
}) {
  const [sessionId, setSessionId] = useState(sessions.some((s) => s.id === defaultSessionId) ? defaultSessionId : "");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!sessionId) { setError("Choose a session to add these to."); return; }
    setError(null);
    setApplying(true);
    const res = await addDrills(
      sessionId,
      plan.drills.map((d) => ({ title: d.name, description: packDrillDescription(d), video_url: "" }))
    );
    setApplying(false);
    if (res.error) { setError(res.error); return; }
    setApplied(true);
    onApplied?.(`Added ${plan.drills.length} drills to the session.`);
  }

  const drills = renderSessionPlanProse(plan).split(/(?=DRILL \d+:)/g).filter(Boolean);

  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-2 max-h-72 overflow-y-auto">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Session from this play</p>
      {drills.map((drill, i) => {
        const [header, ...rest] = drill.trim().split("\n");
        return (
          <div key={i} className="space-y-0.5">
            <p className="text-xs font-semibold">{header}</p>
            <AiProse text={rest.join("\n")} className="text-xs" />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={sessionId}
          onChange={(e) => { setSessionId(e.target.value); setApplied(false); }}
          aria-label="Add to training session"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">Choose a session…</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.when} · {s.label}</option>)}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={applying || applied}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          {applying ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Plus className="size-3 text-primary" aria-hidden="true" />}
          {applied ? "Added" : "Add to session"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
