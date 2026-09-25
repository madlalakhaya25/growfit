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
 * A matchday-poster-style fixture card: a date block, the crest-vs-opponent
 * line, venue and competition tag. Used as the Today hero and in fixture
 * lists — see docs/AI_FEATURES_AND_IA.md Part 4.
 *
 * `bg-ink`/`text-ink-foreground` invert against the page (see globals.css's
 * comment on `--color-ink`) rather than being a fixed dark tile, so this
 * reads as a bold scoreboard in both themes instead of going muddy — or
 * outright wrong-way-round — when the app itself turns dark. Every text
 * colour here is `ink-foreground` at some opacity for the same reason: a
 * literal `text-white/60` happened to be right for the old fixed-dark tile,
 * but is exactly backwards once the band inverts in dark mode.
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
        "group flex items-stretch gap-4 rounded-lg bg-ink px-4 py-4 text-ink-foreground",
        "pitch-lines",
        href && "transition-transform hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center border-r border-ink-foreground/15 pr-4 text-center leading-none">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-foreground/60">{weekday}</span>
        <span className="font-display text-3xl">{day}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-ink-foreground/60">{month}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-foreground/60">
          {competition}
          {teamName && ` · ${teamName}`}
        </p>
        <p className="truncate font-display text-xl leading-tight">
          {isHome ? "vs" : "@"} {opponent}
        </p>
        <p className="text-sm text-ink-foreground/70">
          {time}
          {venue && ` · ${venue}`}
        </p>
      </div>
    </Wrapper>
  );
}
