"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pick an audio mime type the browser can actually record. */
export function pickAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export const extensionForMime = (mime: string): "mp4" | "ogg" | "webm" =>
  mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";

export interface CapturedAudio {
  blob: Blob;
  mime: string;
  /** File extension to use if the caller wraps the blob in a File. */
  ext: "mp4" | "ogg" | "webm";
}

/**
 * The capture half of recording a voice note: ask for the microphone, record
 * with MediaRecorder, count the seconds, stop on request or at `maxSeconds`,
 * and hand the finished clip to `onCaptured`. Nothing here stores or uploads
 * anything, which is the point of the split:
 *   - the play voice note (voice-note-recorder.tsx) uploads the clip to
 *     Supabase Storage;
 *   - match and session narration must NOT: that audio goes inline to the
 *     model and is never written to Storage (docs/BACKLOG.md 5.2). Both use
 *     this hook and differ only in what `onCaptured` does.
 *
 * The microphone is released when recording stops and on unmount.
 */
export function useVoiceCapture({
  maxSeconds = 120,
  onCaptured,
}: {
  maxSeconds?: number;
  onCaptured: (audio: CapturedAudio) => void | Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The latest callback, so a long recording never calls a stale closure.
  const onCapturedRef = useRef(onCaptured);
  useEffect(() => { onCapturedRef.current = onCaptured; });

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const mime = pickAudioMime();
    if (!mime) { setError("This browser can't record audio. Try Chrome."); return; }

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
      await onCapturedRef.current({ blob, mime, ext: extensionForMime(mime) });
    };

    recRef.current = rec;
    rec.start();
    setRecording(true);
    setSeconds(0);
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= maxSeconds) stop();
    }, 1000);
  }, [maxSeconds, stop]);

  return { recording, seconds, error, setError, start, stop };
}
