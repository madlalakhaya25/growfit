"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logMatch } from "@/app/actions/fixtures";
import { POSITIONS } from "@/lib/types";
import { getInitials } from "@/lib/player";

type Player = { id: string; full_name: string; position: string | null };
type PlayerState = { player_id: string; played: boolean; rating: number; note: string };

interface Props {
  fixtureId: string;
  squad: Player[];
  isHome: boolean;
  opponent: string;
  hideCancel?: boolean;
}

export function LogResultForm({ fixtureId, squad, isHome, opponent, hideCancel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [teamScore, setTeamScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [matchNotes, setMatchNotes] = useState("");
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
      });
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Scoreline */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Score</h2>
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
                      <p className="font-medium truncate">{player.full_name}</p>
                      {posLabel && <p className="text-xs text-muted-foreground">{posLabel}</p>}
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
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid size-8 place-items-center rounded-full border border-border text-lg font-bold hover:bg-muted transition-colors"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="w-12 text-center text-4xl font-black tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(30, value + 1))}
          className="grid size-8 place-items-center rounded-full border border-border text-lg font-bold hover:bg-muted transition-colors"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
