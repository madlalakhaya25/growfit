import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isHappeningNow } from "@/lib/session-window";
import { calendarDaysUntil, whenLabel } from "@/lib/today-moments";
import { formatInTimezone, formatTime } from "@/lib/time";

/**
 * The top of Coach Today (2026-10-25, "light card, red edge"): the soonest
 * match or session as one white card with a red top edge and the one or two
 * things to do next, then everything else this week as quiet rows.
 */
export type AgendaItem =
  | { kind: "fixture"; id: string; at: string; opponent: string; isHome: boolean; venue: string | null; team: string | null }
  | { kind: "session"; id: string; at: string; title: string; location: string | null; team: string | null };

const eyebrow = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function NextUpCard({ item, now, sameDayCount }: Readonly<{ item: AgendaItem; now: Date; sameDayCount: number }>) {
  const at = new Date(item.at);
  const isFixture = item.kind === "fixture";
  const onNow = !isFixture && isHappeningNow(item.at, now.getTime());
  const when = whenLabel(at, now, isFixture ? "Kicked off" : "On now");
  const today = calendarDaysUntil(at, now) === 0;
  const meta = [
    item.team,
    isFixture ? (item.isHome ? "Home" : "Away") : "Training",
    sameDayCount > 1 ? `1 of ${sameDayCount} today` : null,
  ].filter(Boolean).join(" · ");
  const base = isFixture ? `/dashboard/coach/fixtures/${item.id}` : `/dashboard/coach/training/${item.id}`;

  return (
    <section
      aria-label={isFixture ? "Next match" : "Next training"}
      className="space-y-3 rounded-[20px] border-t-[6px] border-primary bg-card p-[18px] shadow-float"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={eyebrow}>{meta}</span>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{when}</span>
      </div>
      <Link href={base} className="block py-1 hover:underline decoration-2 underline-offset-4">
        <p className="font-display text-[38px] font-bold leading-none">
          {/* Home or away is in the line above, so no "(away)" here. */}
          {isFixture ? `vs ${item.opponent}` : item.title}
        </p>
      </Link>
      <p className="text-sm text-muted-foreground">
        {isFixture ? "Kickoff " : ""}
        {today ? formatTime(at) : `${formatInTimezone(at, { weekday: "short", day: "numeric", month: "short" })} · ${formatTime(at)}`}
        {isFixture ? item.venue && ` · ${item.venue}` : item.location && ` · ${item.location}`}
      </p>
      <div className="flex gap-2">
        {isFixture ? (
          <>
            <Link
              href={`${base}?tab=squad`}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-primary px-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Pick the squad
            </Link>
            <Link
              href={`${base}/minutes`}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-background px-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Playing time
            </Link>
          </>
        ) : (
          <Link
            href={base}
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-primary px-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {onNow ? "Take the register" : "Open the session"}
          </Link>
        )}
      </div>
    </section>
  );
}

export function ComingUp({ items, now }: Readonly<{ items: AgendaItem[]; now: Date }>) {
  if (items.length === 0) return null;
  const allToday = items.every((i) => calendarDaysUntil(i.at, now) === 0);
  return (
    <section aria-labelledby="coming-up" className="space-y-2">
      <h2 id="coming-up" className={`px-1 ${eyebrow}`}>{allToday ? "Later today" : "Coming up"}</h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
        {items.map((item) => {
          const at = new Date(item.at);
          const days = calendarDaysUntil(at, now);
          const isFixture = item.kind === "fixture";
          const title = isFixture
            ? `${item.team ? `${item.team} ` : ""}vs ${item.opponent}`
            : `${item.team ? `${item.team} ` : ""}training`;
          const sub = [
            days === 0 ? null : days === 1 ? "Tomorrow" : formatInTimezone(at, { weekday: "short", day: "numeric", month: "short" }),
            isFixture ? (item.isHome ? "Home" : "Away") : item.title,
            isFixture ? item.venue : null,
          ].filter(Boolean).join(" · ");
          return (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                href={isFixture ? `/dashboard/coach/fixtures/${item.id}` : `/dashboard/coach/training/${item.id}`}
                className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-hover"
              >
                <span className="w-[52px] shrink-0 font-display text-[22px] font-bold tabular-nums">{formatTime(at)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{title}</span>
                  {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
