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
 * A matchday fixture card: a date block, the opponent line, venue and
 * competition tag. Kept on the standard card surface rather than the old
 * scoreline ink band so it reads consistently in both light and dark mode,
 * without the pitch-texture noise.
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
        "group flex items-stretch gap-4 rounded-2xl border border-border/60 bg-card px-4 py-4 text-card-foreground shadow-card",
        href && "transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99]",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center border-r border-border pr-4 text-center leading-none">
        <span className="text-xs font-bold uppercase tracking-wide text-primary">{weekday}</span>
        <span className="font-display text-3xl">{day}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{month}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {competition}
          {teamName && ` · ${teamName}`}
        </p>
        <p className="truncate text-lg font-extrabold leading-tight tracking-tight">
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
