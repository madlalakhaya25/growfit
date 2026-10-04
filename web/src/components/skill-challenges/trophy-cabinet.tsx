import Link from "next/link";
import { Flame } from "lucide-react";
import { MILESTONE_CATEGORY_META } from "@/lib/development-categories";
import { cn } from "@/lib/utils";
import { formatScore, type ChallengeResult } from "@/lib/skill-challenges";
import { TrophyBadge } from "./trophy-badge";

function weeksLabel(n: number): string {
  return n === 1 ? "1 week in a row" : `${n} weeks in a row`;
}

export function StreakPill({ weeks, className }: Readonly<{ weeks: number; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
        weeks > 0 ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground",
        className
      )}
    >
      <Flame className="size-4" aria-hidden="true" />
      {weeks > 0 ? weeksLabel(weeks) : "No streak yet"}
    </span>
  );
}

/**
 * The medals a child has won, read-only. Shown on the player's development
 * page (as evidence for the Technical category) and to linked parents.
 */
export function TrophyCabinet({
  results,
  streak,
  heading,
  emptyMessage,
  href,
  showCategory = false,
}: Readonly<{
  results: ChallengeResult[];
  streak: number;
  heading: string;
  emptyMessage: string;
  href?: string;
  showCategory?: boolean;
}>) {
  const tech = MILESTONE_CATEGORY_META.technical;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          {showCategory && (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", tech.chip)}>
              <tech.Icon className="size-3.5" aria-hidden="true" />
              {tech.label} evidence
            </span>
          )}
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        <StreakPill weeks={streak} />
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {results.map((r) => (
            <li key={r.challenge.key} className="flex flex-col items-center gap-1 rounded-[10px] bg-secondary/60 px-1 py-2 text-center">
              <TrophyBadge trophy={r.trophy} size={32} compact />
              <span className="text-xs font-medium leading-tight">{r.challenge.name}</span>
              {r.best !== null && (
                <span className="text-[11px] tabular-nums text-muted-foreground">Best {formatScore(r.challenge, r.best)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {href && (
        <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
          Go to challenges
        </Link>
      )}
    </section>
  );
}
