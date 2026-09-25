import { ListChecks } from "lucide-react";
import type { PlayerJob } from "@/lib/board-coaching";

/**
 * Each player's movements in the play, as plain instructions — built from
 * the arrows by playerJobs() (lib/board-coaching.ts). Shown on the board
 * (the "Player jobs" toggle) and on a shared play, so a player can read
 * exactly what the coach drew for them without decoding the diagram.
 */
export function PlayerJobsList({ jobs, className = "" }: { jobs: PlayerJob[]; className?: string }) {
  const ours = jobs.filter((j) => j.side === "player");
  const theirs = jobs.filter((j) => j.side === "opponent");
  return (
    <div className={`rounded-lg border border-border bg-card p-3 space-y-2 ${className}`} data-testid="player-jobs">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <ListChecks className="size-3.5" aria-hidden="true" /> Player jobs
      </p>
      {jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Draw runs, passes and dribbles from a player and their job appears here, step by step.</p>
      ) : (
        <>
          {[ours, theirs].filter((list) => list.length > 0).map((list) => (
            <ul key={list[0].side} className="grid gap-1.5 sm:grid-cols-2">
              {list.map((j) => (
                <li key={j.tokenId} className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                  <span className={`font-semibold ${j.side === "opponent" ? "text-destructive" : ""}`}>{j.label}</span>
                  <ol className="mt-0.5 space-y-0.5 text-muted-foreground">
                    {j.steps.map((st) => <li key={st}>{st}</li>)}
                  </ol>
                </li>
              ))}
            </ul>
          ))}
        </>
      )}
    </div>
  );
}
