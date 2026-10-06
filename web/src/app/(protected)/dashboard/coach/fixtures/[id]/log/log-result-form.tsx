"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logMatch } from "@/app/actions/fixtures";
import { POSITIONS } from "@/lib/types";
import { getInitials } from "@/lib/player";
import type { AttendanceSummary } from "@/lib/attendance";
import { MATCH_PHASES, type MatchPhaseId, type PhaseRatings } from "@/lib/match-phases";
import { presetKeyFor, problemsFor } from "@/lib/match-problems";
import {
  MAX_OPEN_OBJECTIVES, phaseLabel, suggestPhase,
  type FollowUpPrompt, type SeenAgain,
} from "@/lib/objectives";

type Player = { id: string; full_name: string; position: string | null };
type PlayerState = { player_id: string; played: boolean; rating: number; note: string };

interface Props {
  fixtureId: string;
  squad: Player[];
  isHome: boolean;
  opponent: string;
  hideCancel?: boolean;
  /**
   * Training attendance over the rolling window, keyed by player id. A plain
   * object rather than a Map: this crosses the Server-to-Client Component
   * boundary as a prop, and a Map isn't worth relying on there. Lets the
   * coach see who has actually been training while picking Sunday's team,
   * rather than only after the fact on the squad list — the AI's lineup
   * suggestion already weighs this; the human picking by hand couldn't see
   * it at all.
   */
  trainingAttendance?: Record<string, AttendanceSummary>;
  /**
   * Players currently flagged injured or unavailable, keyed by player id —
   * only entries for players who are NOT available (see the two page
   * components that build this). Squad selection used to have no way to
   * know this at all; the AI's suggestLineup/generateMatchPlan already
   * refuse to pick these players, so the human picking by hand should see
   * the same fact, not find out only after typing up the team sheet.
   */
  playerAvailability?: Record<string, { status: string; note: string | null }>;
  /** Objectives this team already has open. At two, the weekly focus step is hidden. */
  openObjectives?: number;
  /** Objectives set at an earlier match, to ask "did we see it again?" about. */
  followUps?: FollowUpPrompt[];
  /** The team's age group, so the tap-to-fill problems fit the age. */
  ageGroup?: string | null;
}

export function LogResultForm({ fixtureId, squad, isHome, opponent, hideCancel, trainingAttendance, playerAvailability, openObjectives = 0, followUps = [], ageGroup = null }: Readonly<Props>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [teamScore, setTeamScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [matchNotes, setMatchNotes] = useState("");
  // Optional: how the team did in each phase of play. Untouched phases are not sent.
  const [phaseRatings, setPhaseRatings] = useState<PhaseRatings>({});
  // "What do we work on this week?" The phase follows the lowest rating until
  // the coach picks one; an empty problem means no objective is created.
  const [focusPhase, setFocusPhase] = useState<MatchPhaseId | "none" | null>(null);
  const [focusProblem, setFocusProblem] = useState("");
  const suggested = suggestPhase(phaseRatings);
  const chosenPhase = chooseFocusPhase(focusPhase, suggested);
  const presets = problemsFor(chosenPhase, ageGroup);
  // Answers to "did we see the problem again?", by objective id.
  const [seenAgain, setSeenAgain] = useState<Record<string, SeenAgain>>({});
  // Answering closes an objective, which frees a place for a new focus.
  const openAfterAnswers = openObjectives - Object.keys(seenAgain).length;
  const [players, setPlayers] = useState<PlayerState[]>(
    squad.map((p) => ({ player_id: p.id, played: false, rating: 3, note: "" }))
  );

  function togglePlayed(id: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.player_id === id ? { ...p, played: !p.played } : p))
    );
  }

  function setRating(id: string, rating: number) {
    setPlayers((prev) =>
      prev.map((p) => (p.player_id === id ? { ...p, rating } : p))
    );
  }

  function setNote(id: string, note: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.player_id === id ? { ...p, note } : p))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const played = players.filter((p) => p.played);
    start(async () => {
      const res = await logMatch({
        fixture_id: fixtureId,
        team_score: teamScore,
        opponent_score: oppScore,
        match_notes: matchNotes || undefined,
        appearances: players.map(({ player_id, played }) => ({ player_id, played })),
        ratings: played.map(({ player_id, rating, note }) => ({
          player_id, rating, note: note || undefined,
        })),
        phase_ratings: Object.keys(phaseRatings).length ? phaseRatings : undefined,
        follow_ups: Object.entries(seenAgain).map(([objectiveId, answer]) => ({ objectiveId, answer })),
        objective: focusProblem.trim() ? { phase: chosenPhase, problem: focusProblem, problemKey: presetKeyFor(focusProblem) } : undefined,
      });
      // No else branch here — on success `logMatch` calls redirect(), which
      // never returns to this callback; it navigates away instead.
      if (res && "error" in res) { setError(res.error); toast.error(res.error); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Scoreline */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <h2 className="mb-4 text-[13px] uppercase text-muted-foreground">Score</h2>
        <div className="flex items-center justify-center gap-6">
          <ScoreInput
            label={isHome ? "Us" : opponent}
            value={teamScore}
            onChange={setTeamScore}
          />
          <span className="text-2xl text-muted-foreground">—</span>
          <ScoreInput
            label={isHome ? opponent : "Us"}
            value={oppScore}
            onChange={setOppScore}
          />
        </div>
      </div>

      {/* Players */}
      {squad.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Squad ({players.filter((p) => p.played).length} played)
          </h2>
          <div className="space-y-2">
            {squad.map((player) => {
              const state = players.find((p) => p.player_id === player.id)!;
              const posLabel = POSITIONS.find((p) => p.value === player.position)?.label;
              const initials = getInitials(player.full_name);
              const attendance = trainingAttendance?.[player.id];
              const availability = playerAvailability?.[player.id];

              return (
                <div
                  key={player.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 transition-colors",
                    state.played ? "border-primary/40 bg-primary/5" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-primary">
                      {initials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium truncate">{player.full_name}</p>
                        {availability && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              availability.status === "injured"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            )}
                            title={availability.note ?? undefined}
                          >
                            {availability.status === "injured" ? "Injured" : "Unavailable"}
                          </span>
                        )}
                      </div>
                      {(posLabel || attendance?.pct != null) && (
                        <p className="text-xs text-muted-foreground">
                          {posLabel}
                          {posLabel && attendance?.pct != null ? " · " : ""}
                          {attendance?.pct != null && (
                            <span className={attendance.belowThreshold ? "font-semibold text-destructive" : undefined}>
                              {attendance.pct}% training
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePlayed(player.id)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        state.played
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {state.played ? "Played ✓" : "Played?"}
                    </button>
                  </div>

                  {state.played && (
                    <div className="mt-4 space-y-3 border-t border-border pt-3">
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Rating</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setRating(player.id, n)}
                              aria-label={`${n} star`}
                            >
                              <Star
                                className={cn(
                                  "size-6 transition-colors",
                                  n <= state.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30 hover:text-amber-300"
                                )}
                                aria-hidden="true"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label htmlFor={`note-${player.id}`} className="text-xs font-medium text-muted-foreground">
                          Coach note (optional)
                        </label>
                        <input
                          id={`note-${player.id}`}
                          type="text"
                          maxLength={200}
                          value={state.note}
                          onChange={(e) => setNote(player.id, e.target.value)}
                          placeholder="e.g. Great pressing, needs work on finishing"
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Follow-up: did the problem we trained for come back? */}
      {followUps.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Did we see the problem again?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              You set this earlier. Your answer closes it and goes in the team history. Coaches only.
            </p>
          </div>
          <div className="space-y-2">
            {followUps.map((f) => {
              const answer = seenAgain[f.id];
              const label = phaseLabel(f.phase);
              return (
                <fieldset key={f.id} className="m-0 rounded-xl border border-border bg-card p-4">
                  <legend className="sr-only">{`Did we see "${f.problem}" again?`}</legend>
                  <p className="text-sm font-medium">{f.objective}</p>
                  {label && f.before && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{label} was rated {f.before} out of 5 last time.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["no", "a_bit", "yes"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={answer === value}
                        onClick={() =>
                          setSeenAgain((prev) => {
                            const next = { ...prev };
                            if (prev[f.id] === value) delete next[f.id];
                            else next[f.id] = value;
                            return next;
                          })
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                          answer === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {{ no: "No, it's gone", a_bit: "A bit", yes: "Yes, still there" }[value]}
                      </button>
                    ))}
                  </div>
                  {(answer === "a_bit" || answer === "yes") && (
                    <button
                      type="button"
                      className="mt-3 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setFocusProblem(f.problem);
                        setFocusPhase(f.phase ?? "none");
                      }}
                    >
                      Keep working on it this week
                    </button>
                  )}
                </fieldset>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase of play — the team, not any one child */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            How did we do in each phase? (optional)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Rate the team, out of 5. Tap a star again to clear it.</p>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {MATCH_PHASES.map((phase) => {
            const value = phaseRatings[phase.id] ?? 0;
            return (
              <div key={phase.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{phase.label}</p>
                  <p className="text-xs text-muted-foreground">{phase.hint}</p>
                </div>
                <fieldset className="m-0 flex gap-1 border-0 p-0">
                  <legend className="sr-only">{`${phase.label} rating`}</legend>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${phase.label}: ${n} out of 5`}
                      aria-pressed={value === n}
                      onClick={() =>
                        setPhaseRatings((prev) => {
                          const next = { ...prev };
                          if (prev[phase.id] === n) delete next[phase.id];
                          else next[phase.id] = n;
                          return next;
                        })
                      }
                    >
                      <Star
                        className={cn(
                          "size-5 transition-colors",
                          n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </fieldset>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly focus: one problem to train for before the next match */}
      {openAfterAnswers < MAX_OPEN_OBJECTIVES && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              What do we work on this week? (optional)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Name one problem you saw. It shows up when you plan training, and at the next match we ask if it came back.
              Coaches only; families never see it.
            </p>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div>
              <label htmlFor="focus_phase" className="text-xs font-medium text-muted-foreground">
                Phase of play{suggested && focusPhase === null ? " (lowest rated)" : ""}
              </label>
              <select
                id="focus_phase"
                value={chosenPhase ?? "none"}
                onChange={(e) => setFocusPhase(e.target.value as MatchPhaseId | "none")}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="none">Not sure</option>
                {MATCH_PHASES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="focus_problem" className="text-xs font-medium text-muted-foreground">The problem</label>
              <input
                id="focus_problem"
                type="text"
                maxLength={200}
                value={focusProblem}
                onChange={(e) => setFocusProblem(e.target.value)}
                placeholder="e.g. We lost the ball when playing out from the back"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {presets.length > 0 && (
                <fieldset className="mt-2 flex flex-wrap gap-2">
                  <legend className="sr-only">Common problems, tap to use</legend>
                  {presets.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={focusProblem.trim() === p.text}
                      onClick={() => setFocusProblem(p.text)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/10"
                    >
                      {p.text}
                    </button>
                  ))}
                </fieldset>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match notes */}
      <div className="space-y-1.5">
        <label htmlFor="match_notes" className="text-sm font-medium">Match notes (optional)</label>
        <textarea
          id="match_notes"
          rows={3}
          maxLength={500}
          value={matchNotes}
          onChange={(e) => setMatchNotes(e.target.value)}
          placeholder="Overall performance notes…"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save result"}
        </Button>
        {!hideCancel && (
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** The picked phase, else the suggestion; "none" is an explicit "Not sure". */
function chooseFocusPhase(picked: MatchPhaseId | "none" | null, suggested: MatchPhaseId | null): MatchPhaseId | null {
  if (picked === null) return suggested;
  return picked === "none" ? null : picked;
}

function ScoreInput({ label, value, onChange }: Readonly<{ label: string; value: number; onChange: (v: number) => void }>) {
  // The number big and condensed like a scoreboard, with an iOS stepper
  // (one grey pill split into − and +) under it.
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-[15px] font-semibold">{label}</p>
      <span className="font-display text-6xl font-bold leading-none tabular-nums">{value}</span>
      <div className="flex items-center rounded-[9px] bg-secondary">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid h-11 w-12 place-items-center text-xl transition-colors hover:bg-foreground/5 rounded-l-[9px]"
          aria-label={`One less for ${label}`}
        >
          −
        </button>
        <span className="h-5 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={() => onChange(Math.min(30, value + 1))}
          className="grid h-11 w-12 place-items-center text-xl transition-colors hover:bg-foreground/5 rounded-r-[9px]"
          aria-label={`One more for ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
