// Save the move as a video (the TacticalPad idea).
//
// A play is drawn frame by frame onto an offscreen <canvas> with
// board-render.ts's drawBoard(), the canvas is captured with
// canvas.captureStream() and MediaRecorder turns that into a WebM. The pure
// parts — whether this browser can do it at all, which board moments each
// video frame shows, and what the file is called — live here so they can be
// tested without a browser.

import { interpolateFrames, totalDurationMs, RECORDABLE_SHAPE_KINDS, BOARD_W, BOARD_H, type Frame, type Token } from "@/lib/board-model";
import { drawBoard, pickRecorderMime, type RenderOverlay } from "@/lib/board-render";

export const VIDEO_FPS = 30;
/** The last pose is held this long so the video doesn't cut dead. */
export const VIDEO_HOLD_MS = 500;
/** Canvas pixels per board unit: 600×900. */
export const VIDEO_SCALE = 6;

/** Can this browser record a canvas to a file? Needs MediaRecorder and
 * canvas.captureStream(); Safari before 14.1 and jsdom have neither. */
export function canRecordVideo(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  if (typeof HTMLCanvasElement === "undefined") return false;
  return typeof HTMLCanvasElement.prototype.captureStream === "function";
}

/** Can this browser save the move as a video by either route: recording the
 * canvas, or encoding MP4 with WebCodecs (lib/board-video-mp4.ts)? Whether the
 * encoder takes H.264 is only known asynchronously; this is the quick check
 * the button uses. */
export function canSaveVideo(): boolean {
  if (canRecordVideo()) return true;
  return typeof VideoEncoder !== "undefined" && typeof HTMLCanvasElement !== "undefined";
}

/**
 * The board moment (ms into the move) each video frame shows: one every
 * 1000/fps ms from 0 to the end of the move, always landing exactly on the
 * last pose, then held for `holdMs`. Drawing to this list instead of to
 * whatever moment a timer happens to fire on keeps every step in the video,
 * even a short one.
 */
export function videoFrameTimes(totalMs: number, fps = VIDEO_FPS, holdMs = VIDEO_HOLD_MS): number[] {
  const total = Math.max(0, totalMs);
  const gap = 1000 / Math.max(1, fps);
  const moving = Math.max(1, Math.ceil(total / gap));
  const out: number[] = [];
  for (let i = 0; i <= moving; i++) out.push(Math.min(total, i * gap));
  const held = Math.round(Math.max(0, holdMs) / gap);
  for (let i = 0; i < held; i++) out.push(total);
  return out;
}

/** "High Press!" → "high-press.webm". Falls back to the team, then "play". */
export function videoFileName(playName: string | null | undefined, teamName: string | null | undefined, mime: string): string {
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const base = [playName, teamName]
    .map((s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .find((s) => s.length > 0) ?? "play";
  return `${base.slice(0, 60)}.${ext}`;
}

export interface RecordMoveOptions {
  baseTokens: Token[];
  frames: Frame[];
  overlay: RenderOverlay;
  showNames: boolean;
}

/**
 * Play the move onto a canvas and record it. Resolves with the video, or
 * null when the browser can't record. Real time: MediaRecorder timestamps
 * by the wall clock, so each frame is drawn when its moment comes round.
 */
export async function recordMoveVideo(opts: RecordMoveOptions): Promise<{ blob: Blob; mime: string } | null> {
  const mime = pickRecorderMime();
  if (!mime || !canRecordVideo()) return null;

  const canvas = document.createElement("canvas");
  canvas.width = BOARD_W * VIDEO_SCALE;
  canvas.height = BOARD_H * VIDEO_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const draw = (ms: number) => {
    const { tokens, shapes } = interpolateFrames(opts.baseTokens, opts.frames, ms);
    // drawBoard() has no zone/text rendering — they'd draw as stray lines.
    const recordable = shapes.filter((sh) => RECORDABLE_SHAPE_KINDS.has(sh.kind));
    drawBoard(ctx, { tokens, shapes: recordable, overlay: opts.overlay, showNames: opts.showNames, scale: VIDEO_SCALE });
  };
  draw(0);

  const stream = canvas.captureStream(VIDEO_FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start();

  const times = videoFrameTimes(totalDurationMs(opts.frames));
  const gap = 1000 / VIDEO_FPS;
  const startedAt = performance.now();
  for (let i = 0; i < times.length; i++) {
    draw(times[i]);
    const wait = startedAt + (i + 1) * gap - performance.now();
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  }

  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  return { blob: new Blob(chunks, { type: mime }), mime };
}

/** Hand a finished video to the browser as a download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
