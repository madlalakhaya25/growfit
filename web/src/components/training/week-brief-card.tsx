import Link from "next/link";
import { CalendarDays, Dumbbell, Swords, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime, formatWeekdayDayMonth } from "@/lib/time";
import { focusForSession, focusSentence, type SquadFocus } from "@/lib/squad-focus";
import type { WeekBrief } from "@/lib/week-brief";

/**
 * The coach's week on one card: the next match, the training planned before it,
 * and what the squad's approved development plans are working on, each with a
 * one-tap way to plan a session around it. Nothing here is shown to players or
 * parents; it reads only plans a coach has already approved.
 */
export function WeekBriefCard({ teamId, brief, focus }: Readonly<{ teamId: string; brief: WeekBrief; focus: SquadFocus }>) {
  const newSession = `/dashboard/coach/training/new?team=${teamId}`;
  const top = focus.rows.slice(0, 2);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold">This week</h2>

      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <Swords className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {brief.fixture ? (
            <span>
              Match: <span className="font-medium">{brief.fixture.opponent}</span>,{" "}
              {formatWeekdayDayMonth(new Date(brief.fixture.fixture_date))} at {formatTime(new Date(brief.fixture.fixture_date))}
            </span>
          ) : (
            <span className="text-muted-foreground">No match in the next seven days.</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {brief.sessions.length > 0 ? (
            <span>
              Training:{" "}
              {brief.sessions.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={`/dashboard/coach/training/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                    {formatWeekdayDayMonth(new Date(s.session_date))}
                  </Link>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">No training planned in the next seven days.</span>
          )}
        </li>
        {brief.trainingGap && (
          <li role="alert" className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
            A match is coming and no training is planned before it.
          </li>
        )}
      </ul>

      {top.length > 0 && (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="size-4" aria-hidden="true" /> What the squad is working on
          </p>
          {top.map((row) => (
            <div key={row.category} className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">{focusSentence(row, focus.squadSize)}</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`${newSession}&focus=${encodeURIComponent(focusForSession(row))}`}>
                  <Dumbbell className="size-4" aria-hidden="true" /> Plan a session
                </Link>
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            From {focus.planned} approved plan{focus.planned === 1 ? "" : "s"}.
          </p>
        </div>
      )}
    </section>
  );
}
