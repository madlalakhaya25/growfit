"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { addDrillFromLibrary } from "@/app/actions/drills";
import type { SessionChoice } from "@/lib/drill-library-data";

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
}

/** Pick one of the coach's upcoming sessions and copy the drill into its plan. */
export function AddToSessionSheet({
  drill,
  sessions,
  onClose,
}: Readonly<{
  drill: { id: string; name: string } | null;
  sessions: readonly SessionChoice[];
  onClose: () => void;
}>) {
  const [pending, start] = useTransition();

  function add(sessionId: string) {
    if (!drill) return;
    start(async () => {
      const res = await addDrillFromLibrary(sessionId, drill.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${drill.name} added to the session.`);
      onClose();
    });
  }

  return (
    <Sheet open={drill !== null} onClose={onClose} title="Add to which session?">
      {sessions.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No sessions coming up.{" "}
          <Link href="/dashboard/coach/training/new" className="font-medium text-primary">Plan one first.</Link>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => add(s.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDay(s.session_date)}{s.team_name ? ` · ${s.team_name}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-primary">Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
