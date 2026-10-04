// The move as a WhatsApp-ready MP4: portrait 720x1280, H.264, 30 fps.
//
// board-video.ts records a canvas in real time with MediaRecorder, which
// gives WebM on most browsers and a file WhatsApp often will not play. Here
// each frame is drawn when we choose (not when a timer fires) and handed to
// the browser's WebCodecs encoder through mediabunny, which writes a normal
// MP4. That is faster than real time and the same on every machine that can
// encode H.264. Where it cannot, makeMp4Video resolves to null and the caller
// falls back to the MediaRecorder path.
//
// What goes in the picture is positions and the first names already on the
// tokens, the play's name and the team's name. Nothing else about a child
// (no surnames, ids, photos) is ever drawn, because this file leaves the app.

import {
  interpolateFrames, totalDurationMs, RECORDABLE_SHAPE_KINDS, BOARD_W, BOARD_H, type Frame, type Token,
} from "@/lib/board-model";
import { drawBoard, type RenderOverlay } from "@/lib/board-render";
import { VIDEO_FPS, VIDEO_HOLD_MS, recordMoveVideo, videoFrameTimes } from "@/lib/board-video";

export const MP4_WIDTH = 720;
export const MP4_HEIGHT = 1280;
const HEADER_H = 110;
/** The pitch fills the full width: 720 / 100 canvas pixels per board unit. */
export const MP4_SCALE = MP4_WIDTH / BOARD_W;
const PITCH_H = BOARD_H * MP4_SCALE; // 1080
const FOOTER_TOP = HEADER_H + PITCH_H;

export interface Mp4Captions {
  /** The play's name. */
  title: string;
  /** Team and age group, or the academy. */
  subtitle: string;
}

/** Keep a caption to one line on the canvas: trimmed, collapsed, cut with an ellipsis. */
export function fitCaption(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…` : t;
}

/** Draw one frame of the video: header, pitch with the move at `ms`, footer. */
export function drawPortraitFrame(
  ctx: CanvasRenderingContext2D,
  opts: { baseTokens: Token[]; frames: Frame[]; ms: number; overlay: RenderOverlay; showNames: boolean; captions: Mp4Captions }
): void {
  const { tokens, shapes } = interpolateFrames(opts.baseTokens, opts.frames, opts.ms);
  // drawBoard() has no zone/text rendering: they would draw as stray lines.
  const recordable = shapes.filter((sh) => RECORDABLE_SHAPE_KINDS.has(sh.kind));

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, MP4_WIDTH, MP4_HEIGHT);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px sans-serif";
  ctx.fillText(fitCaption(opts.captions.title, 28), 36, 46);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "500 28px sans-serif";
  ctx.fillText(fitCaption(opts.captions.subtitle, 44), 36, 86);

  ctx.save();
  ctx.translate(0, HEADER_H);
  drawBoard(ctx, { tokens, shapes: recordable, overlay: opts.overlay, showNames: opts.showNames, scale: MP4_SCALE });
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 26px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Growfit", MP4_WIDTH - 36, FOOTER_TOP + (MP4_HEIGHT - FOOTER_TOP) / 2);
}

/** Can this browser encode H.264 at the video's size? False in jsdom and in
 * browsers without WebCodecs (and so also without an MP4 route). */
export async function canMakeMp4(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof document === "undefined") return false;
  try {
    const { canEncodeVideo } = await import("mediabunny");
    return await canEncodeVideo("avc", { width: MP4_WIDTH, height: MP4_HEIGHT, frameRate: VIDEO_FPS });
  } catch {
    return false;
  }
}

export interface MakeMp4Options {
  baseTokens: Token[];
  frames: Frame[];
  overlay: RenderOverlay;
  showNames: boolean;
  captions: Mp4Captions;
}

/**
 * Encode the move. Resolves with the MP4, or null when this browser cannot
 * encode H.264 (the caller then records a WebM instead).
 */
export async function makeMp4Video(opts: MakeMp4Options): Promise<{ blob: Blob; mime: "video/mp4" } | null> {
  if (!(await canMakeMp4())) return null;
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH } = await import("mediabunny");

  const canvas = document.createElement("canvas");
  canvas.width = MP4_WIDTH;
  canvas.height = MP4_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const source = new CanvasSource(canvas, { codec: "avc", quality: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  await output.start();

  const times = videoFrameTimes(totalDurationMs(opts.frames), VIDEO_FPS, VIDEO_HOLD_MS);
  for (let i = 0; i < times.length; i++) {
    drawPortraitFrame(ctx, { ...opts, ms: times[i] });
    await source.add(i / VIDEO_FPS, 1 / VIDEO_FPS);
  }
  await output.finalize();
  if (!target.buffer) return null;
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), mime: "video/mp4" };
}

/**
 * The video a coach shares: the portrait MP4 where the browser can make one,
 * else the real-time recording (a WebM or MP4, whichever the browser's recorder
 * gives). Null when neither works.
 */
export async function makeShareVideo(opts: MakeMp4Options): Promise<{ blob: Blob; mime: string } | null> {
  const mp4 = await makeMp4Video(opts);
  if (mp4) return mp4;
  return recordMoveVideo({ baseTokens: opts.baseTokens, frames: opts.frames, overlay: opts.overlay, showNames: opts.showNames });
}
