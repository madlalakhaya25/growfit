import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  /** ISO date or datetime — only the calendar date portion is used for placement. */
  date: string;
  title: string;
  time?: string;
  href?: string;
  /** "fixture" or "training" — just picks a dot colour, nothing schema-specific. */
  kind: "fixture" | "training";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_DOT: Record<CalendarEvent["kind"], string> = {
  fixture: "bg-primary",
  training: "bg-emerald-500",
};

/**
 * A month-grid view of fixtures and training sessions (docs/BACKLOG.md
 * 2.1's other half — the `.ics` feed covers the calendar app a parent
 * already has open; this is the same data at a glance inside the app
 * itself, for whoever hasn't subscribed or is just checking on their
 * phone). Navigation is plain links to `?month=YYYY-MM` on the current
 * page, so this needs no client-side state at all.
 */
export function MonthCalendar({
  year,
  month,
  events,
  basePath,
  extraQuery,
}: {
  /** 1-12. */
  year: number;
  month: number;
  events: CalendarEvent[];
  /** The page this calendar lives on, for building prev/next month links — no query string. */
  basePath: string;
  /** Other query params to preserve across month navigation, e.g. `{ view: "calendar" }`. */
  extraQuery?: Record<string, string>;
}) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1) continue;
    const day = d.getDate();
    const list = eventsByDay.get(day) ?? [];
    list.push(e);
    eventsByDay.set(day, list);
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const monthLabel = firstOfMonth.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1;

  const hrefFor = (y: number, m: number) => {
    const params = new URLSearchParams(extraQuery);
    params.set("month", `${y}-${String(m).padStart(2, "0")}`);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <Link
          href={hrefFor(prevMonth.year, prevMonth.month)}
          className="grid size-8 place-items-center rounded-md hover:bg-muted"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <Link
          href={hrefFor(nextMonth.year, nextMonth.month)}
          className="grid size-8 place-items-center rounded-md hover:bg-muted"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const dayEvents = day ? eventsByDay.get(day) ?? [] : [];
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div
              key={i}
              className={cn(
                "min-h-[4.5rem] border-b border-r border-border p-1 last:border-r-0 sm:min-h-[6rem] sm:p-1.5",
                day === null && "bg-muted/20"
              )}
            >
              {day !== null && (
                <>
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday && "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const chip = (
                        <span className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight hover:bg-muted">
                          <span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[e.kind])} aria-hidden="true" />
                          <span className="truncate">{e.title}</span>
                        </span>
                      );
                      return e.href ? (
                        <Link key={e.id} href={e.href} className="block">
                          {chip}
                        </Link>
                      ) : (
                        <div key={e.id}>{chip}</div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <p className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
