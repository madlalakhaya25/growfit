"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateTrainingSession } from "@/app/actions/training";
import { toDateTimeLocal } from "@/components/fixtures/fixture-fields";

/** Mirrors sessionSchema's `session_type` enum exactly. */
const SESSION_TYPES: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "technical", label: "Technical" },
  { value: "tactical", label: "Tactical" },
  { value: "fitness", label: "Fitness" },
  { value: "match_prep", label: "Match prep" },
  { value: "recovery", label: "Recovery" },
];

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Edit a training session's details.
 *
 * Sessions could be created and deleted but never edited, so a wrong date or
 * a venue change meant deleting the session — which takes its drills and any
 * attendance already marked against it — and rebuilding it. Attendance feeds
 * the 75% welfare threshold, so that was not a cosmetic loss.
 */
export function EditSessionButton({
  sessionId,
  session,
}: {
  sessionId: string;
  session: {
    title: string;
    session_date: string;
    location: string | null;
    session_type: string;
    notes: string | null;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updateTrainingSession(sessionId, formData);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Session updated.");
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="shrink-0">
        <Pencil className="size-4" aria-hidden="true" />
        <span className="sr-only">Edit session</span>
      </Button>
    );
  }

  return (
    <form
      action={handleSave}
      className="w-full space-y-4 rounded-xl border border-border bg-card p-4"
    >
      <p className="text-sm font-semibold">Edit session</p>

      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">Title *</label>
        <input id="title" name="title" required minLength={2} maxLength={120}
          defaultValue={session.title} className={inputCls} />
      </div>

      <div className="space-y-1.5">
        {/* Local time, not UTC — see toDateTimeLocal. Without it a 17:00
            session opens showing 15:00 in SAST and saving walks it back two
            hours every time anyone edits it. */}
        <label htmlFor="session_date" className="text-sm font-medium">Date &amp; time *</label>
        <input id="session_date" name="session_date" type="datetime-local" required
          defaultValue={toDateTimeLocal(session.session_date)} className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="session_type" className="text-sm font-medium">Type</label>
        <select id="session_type" name="session_type" defaultValue={session.session_type} className={inputCls}>
          {SESSION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="location" className="text-sm font-medium">Location</label>
        <input id="location" name="location" maxLength={120}
          defaultValue={session.location ?? ""} placeholder="e.g. Chatsworth Stadium" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-medium">Notes</label>
        <textarea id="notes" name="notes" rows={3} maxLength={1000}
          defaultValue={session.notes ?? ""}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
      </div>

      <p className="text-xs text-muted-foreground">
        Drills and any attendance already marked stay as they are. To move this
        to a different team, create a new session instead.
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={pending}>
          <Check className="size-3.5" aria-hidden="true" />
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button size="sm" type="button" variant="outline" disabled={pending}
          onClick={() => { setEditing(false); setError(null); }}>
          <X className="size-3.5" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
