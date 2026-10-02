"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveFamilyMessage, draftMatchStories, retractFamilyMessage, saveFamilyMessage } from "@/app/actions/family-messages";
import { findFlaggedWording } from "@/lib/child-safe-check";
import { FAMILY_BODY_MAX } from "@/lib/family-messages";

export interface StoryRow {
  playerId: string;
  name: string;
  /** Null until a draft is written. */
  message: { id: string; body: string; status: "draft" | "approved"; approvedByName: string | null } | null;
}

function wroteMessage(created: number): string {
  if (created === 0) return "Every child already has a story.";
  return `Wrote ${created} ${created === 1 ? "story" : "stories"}.`;
}

/**
 * A short story about the match for each child's family. Drafts are written for
 * the coach to read, change and share one at a time; a family sees a story only
 * after the coach shares it, and the coach can take it back.
 */
export function MatchStoriesPanel({ fixtureId, rows: initial, available }: Readonly<{ fixtureId: string; rows: StoryRow[]; available: boolean }>) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  const update = (playerId: string, patch: Partial<NonNullable<StoryRow["message"]>>) =>
    setRows((rs) => rs.map((r) => (r.playerId === playerId && r.message ? { ...r, message: { ...r.message, ...patch } } : r)));

  function write() {
    start(async () => {
      const res = await draftMatchStories(fixtureId);
      if (res.error) { toast.error(res.error); return; }
      toast.success(wroteMessage(res.created ?? 0));
      if (res.created) router.refresh();
    });
  }

  const drafts = rows.filter((r) => r.message?.status === "draft").length;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Match stories">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Match stories</h2>
          <p className="text-xs text-muted-foreground">
            A short, kind story for each child's family. Read and change each one, then share it. Nothing is seen until you share it.
          </p>
        </div>
        <button
          type="button" onClick={write} disabled={pending || !available}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {drafts + rows.filter((r) => r.message?.status === "approved").length === 0 ? "Write the stories" : "Write any missing"}
        </button>
      </div>
      {!available && <p className="text-xs text-amber-700 dark:text-amber-400">Stories need a database update that hasn't been run yet (migration 058).</p>}
      <ul className="divide-y divide-border">
        {rows.filter((r) => r.message).map((r) => (
          <StoryItem key={r.playerId} row={r} onChange={update} />
        ))}
      </ul>
    </section>
  );
}

function StoryItem({ row, onChange }: Readonly<{ row: StoryRow; onChange: (playerId: string, patch: Partial<NonNullable<StoryRow["message"]>>) => void }>) {
  const m = row.message!;
  const [text, setText] = useState(m.body);
  const [busy, start] = useTransition();
  const flags = findFlaggedWording(text);
  const dirty = text.trim() !== m.body;

  function save() {
    start(async () => {
      const res = await saveFamilyMessage(m.id, text);
      if (res.error) { toast.error(res.error); return; }
      onChange(row.playerId, { body: text.trim() });
      toast.success("Saved.");
    });
  }
  function share() {
    start(async () => {
      if (dirty) {
        const saved = await saveFamilyMessage(m.id, text);
        if (saved.error) { toast.error(saved.error); return; }
      }
      let res = await approveFamilyMessage(m.id);
      if (res.flagged && window.confirm(`${res.error}\n\nShare it anyway?`)) {
        res = await approveFamilyMessage(m.id, { acknowledgeWording: true });
      }
      if (res.error) {
        if (!res.flagged) toast.error(res.error);
        return;
      }
      onChange(row.playerId, { body: text.trim(), status: "approved" });
      toast.success(`Shared with ${row.name.split(" ")[0]}'s family.`);
    });
  }
  function takeBack() {
    start(async () => {
      const res = await retractFamilyMessage(m.id);
      if (res.error) { toast.error(res.error); return; }
      onChange(row.playerId, { status: "draft", approvedByName: null });
      toast.success("Taken back. The family can't see it now.");
    });
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{row.name}</p>
        {m.status === "approved" && <span className="text-xs text-green-700 dark:text-green-400">Shared{m.approvedByName ? ` by ${m.approvedByName}` : ""}</span>}
      </div>
      {m.status === "approved" ? (
        <>
          <p className="text-sm">{m.body}</p>
          <button type="button" onClick={takeBack} disabled={busy} className="text-xs underline disabled:opacity-60">Take back to edit</button>
        </>
      ) : (
        <>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} maxLength={FAMILY_BODY_MAX} rows={4}
            aria-label={`Story for ${row.name}`}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          {flags.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">May read as negative: {flags.join(", ")}.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || !dirty} className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50">Save</button>
            <button type="button" onClick={share} disabled={busy} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60">Share with family</button>
          </div>
        </>
      )}
    </li>
  );
}
