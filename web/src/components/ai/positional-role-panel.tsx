"use client";

import { useMemo, useState, useTransition } from "react";
import { UserCircle, Play, Wand2 } from "lucide-react";
import { POSITIONS, type Position } from "@/lib/types";
import { POSITION_GROUPS, conceptsForPositionGroup, youtubeSearchUrl } from "@/lib/tactics";
import { explainPositionalRole } from "@/app/actions/tactics";
import { generateSessionPlan } from "@/app/actions/session-generator";

const AGE_GROUPS = ["U9", "U11", "U13", "U15", "U17", "U19", "Senior"];

// Legacy catch-all values (e.g. "defender") duplicate the specific ones — hide
// them from the picker so coaches choose a real role.
const LEGACY = new Set(["goalkeeper", "defender", "midfielder", "winger", "striker"]);

export function PositionalRolePanel() {
  const positions = useMemo(() => POSITIONS.filter((p) => !LEGACY.has(p.value)), []);
  const [positionValue, setPositionValue] = useState(positions[0].value);
  const [ageGroup, setAgeGroup] = useState("U15");

  const [explanation, setExplanation] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isExplaining, startExplain] = useTransition();
  const [isSessioning, startSession] = useTransition();

  const position = positions.find((p) => p.value === positionValue)!;
  const relatedConcepts = conceptsForPositionGroup(position.group);

  function runExplain() {
    setError(null);
    setSession(null);
    startExplain(async () => {
      const result = await explainPositionalRole({ positionLabel: position.label, ageGroup });
      if (result.error) setError(result.error);
      else setExplanation(result.explanation ?? null);
    });
  }

  function runSession() {
    setError(null);
    startSession(async () => {
      const result = await generateSessionPlan({
        ageGroup,
        sessionType: "positional",
        focusArea: `${position.label} role and responsibilities`,
        durationMinutes: 75,
        squadSize: 16,
      });
      if (result.error) setError(result.error);
      else setSession(result.plan ?? null);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <UserCircle className="size-4 text-primary shrink-0" aria-hidden="true" />
        <p className="font-semibold text-sm">Positional Roles</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="pr-position">
              Position
            </label>
            <select
              id="pr-position"
              value={positionValue}
              onChange={(e) => {
                setPositionValue(e.target.value as Position);
                setExplanation(null);
                setSession(null);
                setError(null);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {POSITION_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {positions.filter((p) => p.group === g).map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="pr-age">
              Age group
            </label>
            <select
              id="pr-age"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {AGE_GROUPS.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runExplain}
            disabled={isExplaining}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <UserCircle className="size-3.5" aria-hidden="true" />
            {isExplaining ? "Thinking…" : "Explain this role"}
          </button>
          <button
            type="button"
            onClick={runSession}
            disabled={isSessioning}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Wand2 className="size-3.5 text-primary" aria-hidden="true" />
            {isSessioning ? "Building…" : "Build a session for this role"}
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {(isExplaining || isSessioning) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
            {isExplaining ? "Writing an age-appropriate role breakdown…" : "Creating your session plan…"}
          </div>
        )}

        {explanation && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-1">
            {explanation.trim().split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
            ))}
          </div>
        )}

        {/* Concepts that matter to this position */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Key concepts for a {position.group.toLowerCase()}
          </p>
          <div className="flex flex-col gap-2">
            {relatedConcepts.map((c) => (
              <a
                key={c.id}
                href={youtubeSearchUrl(c.searchQueries[0])}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 hover:bg-muted"
              >
                <Play className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.summary}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        {session && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-4">
            <p className="text-sm font-semibold">Session for {position.label} · {ageGroup}</p>
            {session.split(/(?=DRILL \d+:)/g).filter(Boolean).map((drill, i) => {
              const lines = drill.trim().split("\n");
              return (
                <div key={i} className="space-y-1">
                  <p className="font-semibold text-sm text-foreground">{lines[0]}</p>
                  {lines.slice(1).map((line, j) => (
                    <p key={j} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
