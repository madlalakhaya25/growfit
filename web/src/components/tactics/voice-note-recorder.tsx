"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Loader2 } from "lucide-react";
import { uploadPlayVoiceNote, deletePlayVoiceNote } from "@/app/actions/tactic-plays";

const MAX_SECONDS = 120;

/** Pick an audio mime type the browser can actually record. */
function pickAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

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
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setUrl(initialUrl); }, [initialUrl]);
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    setError(null);
    const mime = pickAudioMime();
    if (!mime) { setError("This browser can't record audio. Try Chrome."); return; }
    if (!playId) { setError("Save the play first, then record."); return; }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone permission was declined.");
      return;
    }
    streamRef.current = stream;

    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);

      const blob = new Blob(chunks, { type: mime });
      if (blob.size === 0) { setError("Nothing was recorded."); return; }

      setBusy(true);
      try {
        const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
        const fd = new FormData();
        fd.append("play_id", playId);
        fd.append("file", new File([blob], `voice-note.${ext}`, { type: mime }));
        const res = await uploadPlayVoiceNote(fd);
        if (res.error) { setError(res.error); return; }
        setUrl(res.url ?? null);
        onChange?.(res.url ?? null);
      } catch (err) {
        setError(err instanceof Error ? `Could not save the recording: ${err.message}` : "Could not save the recording.");
      } finally {
        setBusy(false);
      }
    };

    recRef.current = rec;
    rec.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  async function remove() {
    if (!playId) return;
    setBusy(true);
    try {
      const res = await deletePlayVoiceNote(playId);
      if (res.error) { setError(res.error); return; }
      setUrl(null);
      onChange?.(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the recording.");
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
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={url} className="w-full h-8" />
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
