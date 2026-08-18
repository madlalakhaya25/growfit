"use client";

import { useState, useTransition } from "react";
import { Lightbulb, Play, Wand2 } from "lucide-react";
import {
  TACTICAL_CATEGORIES,
  TACTICAL_CONCEPTS,
  getConcept,
  youtubeSearchUrl,
} from "@/lib/tactics";
import { explainTacticalConcept } from "@/app/actions/tactics";
import { generateSessionPlan } from "@/app/actions/session-generator";

const AGE_GROUPS = ["U9", "U11", "U13", "U15", "U17", "U19", "Senior"];

export function TacticalConceptPanel() {
  const [conceptId, setConceptId] = useState<string>(TACTICAL_CONCEPTS[0].id);
  const [ageGroup, setAgeGroup] = useState("U15");

  const [explanation, setExplanation] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isExplaining, startExplain] = useTransition();
  const [isSessioning, startSession] = useTransition();

  const concept = getConcept(conceptId)!;

  function runExplain() {
    setError(null);
    setSession(null);
    startExplain(async () => {
      const result = await explainTacticalConcept({ conceptId, ageGroup });
      if (result.error) setError(result.error);
      else setExplanation(result.explanation ?? null);
    });
  }

  function runSession() {
    setError(null);
    startSession(async () => {
      const result = await generateSessionPlan({
        ageGroup,
        sessionType: "tactical",
        focusArea: concept.label,
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
        <Lightbulb className="size-4 text-primary shrink-0" aria-hidden="true" />
        <p className="font-semibold text-sm">Tactical Concept Coach</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Concept picker */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="tc-concept">
            Tactical concept
          </label>
          <select
            id="tc-concept"
            value={conceptId}
            onChange={(e) => {
              setConceptId(e.target.value);
              setExplanation(null);
              setSession(null);
              setError(null);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {TACTICAL_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {TACTICAL_CONCEPTS.filter((c) => c.category === cat).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted-foreground pt-0.5">{concept.summary}</p>
        </div>

        {/* Age group */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="tc-age">
            Age group
          </label>
          <select
            id="tc-age"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary sm:max-w-[12rem]"
          >
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runExplain}
            disabled={isExplaining}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Lightbulb className="size-3.5" aria-hidden="true" />
            {isExplaining ? "Thinking…" : "Explain this concept"}
          </button>
          <button
            type="button"
            onClick={runSession}
            disabled={isSessioning}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Wand2 className="size-3.5 text-primary" aria-hidden="true" />
            {isSessioning ? "Building…" : "Build a session for this"}
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {(isExplaining || isSessioning) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
            {isExplaining ? "Writing an age-appropriate explanation…" : "Creating your session plan…"}
          </div>
        )}

        {/* Explanation */}
        {explanation && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-1">
            {explanation
              .trim()
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {line}
                </p>
              ))}
          </div>
        )}

        {/* Watch: curated YouTube search links */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Watch &amp; learn
          </p>
          <div className="flex flex-col gap-2">
            {concept.searchQueries.map((q) => (
              <a
                key={q}
                href={youtubeSearchUrl(q)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
              >
                <Play className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="capitalize">{q}</span>
              </a>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Opens curated YouTube results — always vet a clip before sharing it with players.
          </p>
        </div>

        {/* Generated session */}
        {session && (
          <div className="rounded-lg border border-border bg-background p-4 space-y-4">
            <p className="text-sm font-semibold">Session for “{concept.label}” · {ageGroup}</p>
            {session
              .split(/(?=DRILL \d+:)/g)
              .filter(Boolean)
              .map((drill, i) => {
                const lines = drill.trim().split("\n");
                const header = lines[0];
                const rest = lines.slice(1);
                return (
                  <div key={i} className="space-y-1">
                    <p className="font-semibold text-sm text-foreground">{header}</p>
                    {rest.map((line, j) => (
                      <p key={j} className="text-sm text-muted-foreground leading-relaxed">
                        {line}
                      </p>
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
