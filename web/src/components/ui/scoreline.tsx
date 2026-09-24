import { cn } from "@/lib/utils";

interface ScorelineProps {
  homeLabel: string;
  awayLabel: string;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Shown between the two scores when the match hasn't been played yet. */
  placeholder?: string;
  className?: string;
}

/**
 * "Growfit U13  2 – 1  Durban Rovers" — the big scoreline used on a fixture's
 * matchday header. Falls back to a placeholder ("vs" / a kickoff time) when
 * no result has been logged, so the same component covers upcoming and
 * played fixtures without a caller branching on it.
 */
export function Scoreline({ homeLabel, awayLabel, homeScore, awayScore, placeholder = "vs", className }: ScorelineProps) {
  const played = homeScore != null && awayScore != null;
  return (
    <div className={cn("flex items-center justify-center gap-3 font-display text-2xl sm:text-3xl", className)}>
      <span className="min-w-0 truncate text-right">{homeLabel}</span>
      {played ? (
        <span className="flex shrink-0 items-center gap-2 tabular-nums" aria-label={`${homeScore} to ${awayScore}`}>
          <span>{homeScore}</span>
          <span className="text-muted-foreground">–</span>
          <span>{awayScore}</span>
        </span>
      ) : (
        <span className="shrink-0 text-base font-sans font-medium text-muted-foreground">{placeholder}</span>
      )}
      <span className="min-w-0 truncate text-left">{awayLabel}</span>
    </div>
  );
}
