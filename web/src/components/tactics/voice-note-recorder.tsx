"use client";

import { useState } from "react";
import { Mic, Square, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadPlayVoiceNote, deletePlayVoiceNote } from "@/app/actions/tactic-plays";
import { useVoiceCapture, type CapturedAudio } from "@/components/tactics/use-voice-capture";

const MAX_SECONDS = 120;

/**
 * Lets a coach record a short spoken explanation and attach it to a saved play.
 * Players hear it when they open the shared play, so the tactics arrive in the
 * coach's own voice rather than only as diagrams.
 */
export function VoiceNoteRecorder({
  playId,
  initialUrl,
  onChange,
}: {
  playId: string | null;
  initialUrl: string | null;
  onChange?: (url: string | null) => void;
}) {
  // `url` used to re-sync from `initialUrl` via a `useEffect`, which only
  // covered `url` itself -- switching which play this recorder is attached
  // to left `recording`/`seconds`/`error` untouched, so a stale error
  // message (or worse, an apparently-active recording) could bleed from one
  // play into the next. The caller now remounts this component on play
  // identity change instead (`key={playId ?? "new"}`, tactical-board.tsx /
  // film-board.tsx), which resets every piece of state here at once -- the
  // correct fix, not just the one that satisfied the linter.
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);

  // Recording itself lives in useVoiceCapture; this component only decides
  // what to do with a finished clip (upload it to the play).
  async function upload({ blob, mime, ext }: CapturedAudio) {
    if (!playId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("play_id", playId);
      fd.append("file", new File([blob], `voice-note.${ext}`, { type: mime }));
      const res = await uploadPlayVoiceNote(fd);
      if (res.error) { setError(res.error); toast.error(res.error); return; }
      setUrl(res.url ?? null);
      onChange?.(res.url ?? null);
    } catch (err) {
      const message = err instanceof Error ? `Could not save the recording: ${err.message}` : "Could not save the recording.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const { recording, seconds, error, setError, start: startCapture, stop } = useVoiceCapture({
    maxSeconds: MAX_SECONDS,
    onCaptured: upload,
  });

  function start() {
    if (!playId) { setError("Save the play first, then record."); return; }
    void startCapture();
  }

  async function remove() {
    if (!playId) return;
    setBusy(true);
    try {
      const res = await deletePlayVoiceNote(playId);
      if (res.error) { setError(res.error); toast.error(res.error); return; }
      setUrl(null);
      onChange?.(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete the recording.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {recording ? (
          <button type="button" onClick={stop} className="inline-flex h-8 items-center gap-1 rounded-md bg-destructive px-2 text-xs font-semibold text-white">
            <Square className="size-3" aria-hidden="true" />
            Stop {String(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, "0")}
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy || !playId}
            title={playId ? "Record a voice note for this play" : "Save the play first"}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Mic className="size-3 text-primary" aria-hidden="true" />}
            {busy ? "Saving…" : url ? "Re-record" : "Voice note"}
          </button>
        )}
        {url && !recording && (
          <button type="button" onClick={remove} disabled={busy} title="Delete voice note" className="rounded-md border border-border bg-background px-1.5 py-1 hover:bg-muted disabled:opacity-50">
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {url && !recording && (
        <audio controls src={url} className="w-full h-8" />
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
