"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { draftWeeklyDigests } from "@/app/actions/family-messages";
import { StoryItem, type StoryRow } from "@/components/fixtures/match-stories-panel";

function wroteMessage(created: number): string {
  if (created === 0) return "Nothing new to write.";
  return `Wrote ${created} ${created === 1 ? "note" : "notes"}.`;
}

/**
 * This week's short note for each child's family. Drafts are written for the
 * coach to read, change and share one at a time, or copy to WhatsApp once
 * shared; a family sees a note only after the coach shares it.
 */
export function WeeklyDigestPanel({ teamId, rows: initial, available }: Readonly<{ teamId: string; rows: StoryRow[]; available: boolean }>) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = (playerId: string, patch: Partial<NonNullable<StoryRow["message"]>>) =>
    setRows((rs) => rs.map((r) => (r.playerId === playerId && r.message ? { ...r, message: { ...r.message, ...patch } } : r)));

  function write() {
    start(async () => {
      const res = await draftWeeklyDigests(teamId);
      if (res.error) { toast.error(res.error); return; }
      toast.success(wroteMessage(res.created ?? 0));
      if (res.created) router.refresh();
    });
  }

  const written = rows.filter((r) => r.message);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Weekly notes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-md text-xs text-muted-foreground">
          A short, kind note for each child's family about this week, with one thing to try at home from their approved plan. Read and change each one, then share it. Nothing is seen until you share it.
        </p>
        <button
          type="button" onClick={write} disabled={pending || !available}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {written.length === 0 ? "Write this week's notes" : "Write any missing"}
        </button>
      </div>
      {!available && <p className="text-xs text-amber-700 dark:text-amber-400">Notes need a database update that hasn't been run yet (migration 058).</p>}
      <ul className="divide-y divide-border">
        {written.map((r) => <StoryItem key={r.playerId} row={r} onChange={update} noun="Note" />)}
      </ul>
    </section>
  );
}
