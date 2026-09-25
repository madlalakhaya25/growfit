import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FixtureTicketProps {
  href?: string;
  /** e.g. "Sun" */
  weekday: string;
  /** e.g. "12" */
  day: string;
  /** e.g. "Oct" */
  month: string;
  time: string;
  opponent: string;
  isHome: boolean;
  venue?: string | null;
  teamName?: string | null;
  competition?: string;
  className?: string;
}

/**
 * A fixture card: a date block, the crest-vs-opponent line, venue and
 * competition tag. Used as the Today hero and in fixture lists.
 *
 * This used to be a dark "ink" band — a deliberate matchday-poster look
 * (see docs/AI_FEATURES_AND_IA.md Part 4) — but that put a near-black
 * surface in the middle of the app's otherwise light-in-light-mode,
 * dark-in-dark-mode pages, which read as broken rather than designed.
 * It's the plain Card surface now, like everything else.
 */
export function FixtureTicket({
  href,
  weekday,
  day,
  month,
  time,
  opponent,
  isHome,
  venue,
  teamName,
  competition = "GDFL",
  className,
}: FixtureTicketProps) {
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...(wrapperProps as { href: string })}
      className={cn(
        "group flex items-stretch gap-4 rounded-lg border border-border bg-card px-4 py-4 text-card-foreground shadow-sm",
        href && "transition-transform hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center border-r border-border pr-4 text-center leading-none">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{weekday}</span>
        <span className="font-display text-3xl">{day}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{month}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {competition}
          {teamName && ` · ${teamName}`}
        </p>
        <p className="truncate font-display text-xl leading-tight">
          {isHome ? "vs" : "@"} {opponent}
        </p>
        <p className="text-sm text-muted-foreground">
          {time}
          {venue && ` · ${venue}`}
        </p>
      </div>
    </Wrapper>
  );
}
