"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addPlannedSession } from "@/app/actions/term-plan";
import { CORNER_LABELS, LOAD_LABELS, type PlanWeek, type PlannedSession } from "@/lib/term-plan";

const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function SessionRow({ teamId, session, added }: Readonly<{ teamId: string; session: PlannedSession; added: boolean }>) {
  const [done, setDone] = useState(added);
  const [busy, start] = useTransition();
  function add() {
    start(async () => {
      const res = await addPlannedSession({ teamId, date: session.date, title: session.title, type: session.type, notes: session.notes });
      if (res.error) { toast.error(res.error); return; }
      setDone(true);
      toast.success("Added to training.");
    });
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{session.title}</p>
        <p className="text-xs text-muted-foreground">{fmt(session.date)} · {session.intensity} effort</p>
      </div>
      {done
        ? <span className="text-xs text-green-700 dark:text-green-400">On your training list</span>
        : <button type="button" onClick={add} disabled={busy} className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60">Add to training</button>}
    </li>
  );
}

/** The term, one week at a time: load, the corner in focus, the match, and the two sessions. */
export function TermPlanView({ teamId, weeks, sessionDates }: Readonly<{ teamId: string; weeks: PlanWeek[]; sessionDates: string[] }>) {
  const have = new Set(sessionDates);
  return (
    <ol className="space-y-3">
      {weeks.map((w) => (
        <li key={w.weekKey} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Week {w.index + 1} · {fmt(w.weekKey)}</h2>
            <span className="text-xs font-medium text-muted-foreground">{LOAD_LABELS[w.load]} · {CORNER_LABELS[w.corner]}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{w.note}</p>
          {w.fixtures.length > 0 && (
            <p className="mt-1 text-sm">Match: {w.fixtures.map((f) => `${f.opponent} (${fmt(f.date)})`).join(", ")}</p>
          )}
          <ul className="mt-2 divide-y divide-border">
            {w.sessions.map((s) => <SessionRow key={s.date} teamId={teamId} session={s} added={have.has(s.date)} />)}
          </ul>
        </li>
      ))}
    </ol>
  );
}
