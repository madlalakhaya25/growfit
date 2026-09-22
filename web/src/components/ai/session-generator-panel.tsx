"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateSessionPlan, type SessionPlanStructured } from "@/app/actions/session-generator";
import { addDrills } from "@/app/actions/training";
import { packDrillDescription } from "@/lib/drill-description";
import { AiProse } from "@/components/ai/ai-prose";

interface Props {
  sessionId: string;
  teamId: string;
}

export function SessionGeneratorPanel({ sessionId, teamId: _teamId }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [structured, setStructured] = useState<SessionPlanStructured | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const [ageGroup, setAgeGroup] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(75);
  const [squadSize, setSquadSize] = useState(16);

  function runGenerate() {
    setError(null);
    setApplied(false);
    startTransition(async () => {
      const result = await generateSessionPlan({
        ageGroup,
        sessionType: "general",
        focusArea,
        durationMinutes,
        squadSize,
        sessionId,
      });
      if (result.error) { setError(result.error); toast.error(result.error); }
      else { setPlan(result.plan ?? null); setStructured(result.structured ?? null); }
    });
  }

  async function applyToSession() {
    if (!structured) return;
    setApplying(true);
    const res = await addDrills(
      sessionId,
      structured.drills.map((d) => ({
        title: d.name,
        description: packDrillDescription(d),
        video_url: "",
      }))
    );
    setApplying(false);
    if (res.error) { toast.error(res.error); return; }
    setApplied(true);
    toast.success(`Added ${structured.drills.length} drills to this session.`);
    router.refresh();
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    runGenerate();
  }

  function handleStartOver() {
    setPlan(null);
    setStructured(null);
    setError(null);
    setApplied(false);
  }

  // Parse drills: split on DRILL N: lines
  function parseDrills(text: string) {
    return text.split(/(?=DRILL \d+:)/g).filter(Boolean);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Wand2 className="size-4 text-primary shrink-0" aria-hidden="true" />
          <p className="font-semibold text-sm">AI Session Generator</p>
        </div>
        {plan && (
          <button
            type="button"
            onClick={handleStartOver}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Start over
          </button>
        )}
      </div>

      {/* Form state */}
      {!plan && (
        <form onSubmit={handleGenerate} className="px-4 py-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="sg-age-group">
                Age Group
              </label>
              <input
                id="sg-age-group"
                type="text"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="e.g. U15, U17, Senior"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="sg-focus">
                Session Focus
              </label>
              <input
                id="sg-focus"
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="e.g. Pressing, Finishing, Passing combinations"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="sg-duration">
                Duration
              </label>
              <select
                id="sg-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={60}>60 min</option>
                <option value={75}>75 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="sg-squad">
                Squad Size
              </label>
              <input
                id="sg-squad"
                type="number"
                min={4}
                max={40}
                value={squadSize}
                onChange={(e) => setSquadSize(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Wand2 className="size-3.5" aria-hidden="true" />
            {isPending ? "Generating…" : "Generate Session Plan"}
          </button>

          {isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
              Creating your session plan…
            </div>
          )}
        </form>
      )}

      {/* Results state */}
      {plan && (
        <div className="px-4 py-4 space-y-4">
          {parseDrills(plan).map((drill, i) => {
            const lines = drill.trim().split("\n");
            const header = lines[0];
            const rest = lines.slice(1);
            return (
              <div key={i} className="space-y-1">
                <p className="font-semibold text-sm text-foreground">{header}</p>
                <AiProse text={rest.join("\n")} />
              </div>
            );
          })}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runGenerate}
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Wand2 className="size-3" aria-hidden="true" />
              {isPending ? "Generating…" : "Regenerate"}
            </button>

            {structured && (
              <button
                type="button"
                onClick={applyToSession}
                disabled={applying || applied}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {applying ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Plus className="size-3 text-primary" aria-hidden="true" />}
                {applied ? "Added to session" : "Apply to this session"}
              </button>
            )}
          </div>

          {isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
              Regenerating session plan…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
