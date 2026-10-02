"use client";

import { useState, useTransition } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCoachNote, saveCoachNote, transcribeCoachNote } from "@/app/actions/coach-notes";
import { Button } from "@/components/ui/button";
import { useVoiceCapture } from "@/components/tactics/use-voice-capture";
import { NOTE_MAX, type CoachNote, type NoteSource, type NoteSubject } from "@/lib/coach-notes";

interface Props {
  subjectType: NoteSubject;
  subjectId: string;
  initialNotes: CoachNote[];
  /** False until migration 056: the box still shows, saving explains. */
  available: boolean;
  label: string;
  placeholder: string;
}

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

/**
 * A private note, typed or dictated. A dictated note is written out for the
 * coach to read and correct before anything is saved, and the recording itself
 * is never kept. Only the author and academy admins can ever read these.
 */
export function CoachNotesBox({ subjectType, subjectId, initialNotes, available, label, placeholder }: Readonly<Props>) {
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [source, setSource] = useState<NoteSource>("typed");
  const [writing, setWriting] = useState(false);
  const [saving, startSave] = useTransition();

  const { recording, seconds, error, start, stop } = useVoiceCapture({
    maxSeconds: 120,
    onCaptured: async ({ blob, ext }) => {
      setWriting(true);
      const form = new FormData();
      form.append("audio", new File([blob], `note.${ext}`, { type: blob.type }));
      const res = await transcribeCoachNote(form);
      setWriting(false);
      if (res.error || !res.text) {
        toast.error(res.error ?? "Couldn't write that out.");
        return;
      }
      const heard = res.text;
      setText((t) => (t ? `${t}\n${heard}` : heard).slice(0, NOTE_MAX));
      setSource("voice");
    },
  });

  function save() {
    startSave(async () => {
      const res = await saveCoachNote({ subjectType, subjectId, body: text, source });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setNotes((n) => [{ id: `new-${n.length}-${text.length}`, body: text.trim(), source, createdAt: new Date().toISOString(), mine: true }, ...n]);
      setText("");
      setSource("typed");
      toast.success("Note saved.");
    });
  }

  function remove(id: string) {
    const before = notes;
    setNotes((n) => n.filter((x) => x.id !== id));
    void deleteCoachNote(id).then((r) => {
      if (r.error) {
        setNotes(before);
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">{label}</h2>
        <p className="text-xs text-muted-foreground">Private to you and the academy admins. Never shown to players or parents.</p>
      </div>

      <textarea
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        rows={3}
        maxLength={NOTE_MAX}
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" size="sm" variant="outline" onClick={stop}>
            <Square className="size-4" aria-hidden="true" /> Stop ({seconds}s)
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => void start()} disabled={writing}>
            <Mic className="size-4" aria-hidden="true" /> {writing ? "Writing it out…" : "Dictate"}
          </Button>
        )}
        <Button type="button" size="sm" onClick={save} disabled={saving || recording || writing || !text.trim()}>
          {saving ? "Saving…" : "Save note"}
        </Button>
        {source === "voice" && text && <span className="text-xs text-muted-foreground">Written from your voice. Check it before saving.</span>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!available && <p className="text-xs text-muted-foreground">Notes are not switched on yet. Ask your administrator to finish setting them up.</p>}

      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dateOf(n.createdAt)}{n.source === "voice" ? " · dictated" : ""}{n.mine ? "" : " · another coach"}</p>
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label="Delete note" onClick={() => remove(n.id)}>
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
