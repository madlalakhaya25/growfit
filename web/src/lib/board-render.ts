// Canvas renderer for the tactical board.
//
// The board is drawn as SVG in React for interactivity, but recording needs a
// canvas: MediaRecorder captures a canvas stream directly, with no per-frame
// SVG serialise/decode round-trip. This module draws the same picture with the
// 2D API so a play can be recorded as a video.
//
// Shape colours and the wavy dribble-path construction come from
// board-model.ts, the one place those are defined now — see that file's
// header for why.

import {
  BOARD_W, BOARD_H, GROUP_COLOR, shapeColor, shapeWidth, getPitch, arrowSpine, wavyPoints, pressMarks, type ShapeKind,
} from "@/lib/board-model";

export { BOARD_W, BOARD_H };
export const BOARD_GROUP_COLOR = GROUP_COLOR;

// Accepts the full shared ShapeKind so a caller can pass a board's real
// Shape[] without a type error — but the draw loop below only has distinct
// branches for "free" and "dribble"; zone/spotlight/text (both the pitch
// board's spotlight tool and the film board's zone/text tools can produce
// these now) draw as a stray line/arrow instead of the real shape. Filter
// with RECORDABLE_SHAPE_KINDS (board-model.ts) before calling drawBoard —
// tactical-board.tsx's recorder already does.
export type RenderShapeKind = ShapeKind;
export type RenderOverlay = "none" | "thirds" | "channels" | "zone14";

export interface RenderToken {
  label: string;
  x: number;
  y: number;
  kind: "player" | "opponent" | "ball";
  group: string;
}
export interface RenderShape {
  kind: RenderShapeKind;
  pts: { x: number; y: number }[];
  color?: string;
  width?: number;
  curve?: number;
}

/** Same rule as token-glyph.tsx's tokenBadge: slot numbers stay numbers,
 * a name shows its initial. */
function badgeFor(label: string): string {
  const t = label.trim();
  if (!t) return "";
  return /^\d{1,2}$/.test(t) ? t : t[0].toUpperCase();
}

/** Mirrors TokenGlyph (components/tactics/token-glyph.tsx) on canvas, so a
 * recorded video looks like the board it was recorded from. */
function drawToken(ctx: CanvasRenderingContext2D, tok: RenderToken, showNames: boolean, s: number) {
  const cx = tok.x * s, cy = tok.y * s;
  const R = (tok.kind === "ball" ? 2.4 : 4.2) * s;

  // Contact shadow
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx + 0.5 * s, cy + R * 0.78, R * 1.0, R * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const gloss = () => {
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.45, 0, cx, cy, R * 1.4);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.45, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  };

  if (tok.kind === "ball") {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = ((-90 + i * 72) * Math.PI) / 180;
      const px = cx + Math.cos(a) * 0.95 * s, py = cy + Math.sin(a) * 0.95 * s;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    gloss();
    ctx.lineWidth = 0.3 * s;
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  const isOpp = tok.kind === "opponent";
  ctx.fillStyle = BOARD_GROUP_COLOR[tok.group] ?? "#22c55e";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  gloss();
  ctx.lineWidth = (isOpp ? 0.7 : 0.5) * s;
  ctx.strokeStyle = isOpp ? "#f43f5e" : "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, R - 0.35 * s, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "center";
  const badge = badgeFor(tok.label);
  if (badge) {
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${(badge.length > 1 ? 3.2 : 3.6) * s}px sans-serif`;
    ctx.fillText(badge, cx, cy + 1.25 * s);
  }
  if (!isOpp && showNames && tok.label && !/^\d{1,2}$/.test(tok.label.trim())) {
    const ny = cy + (4.2 + 3.3) * s;
    ctx.font = `600 ${2.5 * s}px sans-serif`;
    const w = ctx.measureText(tok.label).width + 2.6 * s;
    ctx.fillStyle = "rgba(15,23,42,0.82)";
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, ny - 2.1 * s, w, 3.3 * s, 1.65 * s);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(tok.label, cx, ny + 0.35 * s);
  }
}

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, s: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = 3 * s;
  ctx.beginPath();
  ctx.moveTo(x2 * 1, y2 * 1);
  ctx.lineTo(x2 - len * Math.cos(ang - Math.PI / 7), y2 - len * Math.sin(ang - Math.PI / 7));
  ctx.lineTo(x2 - len * Math.cos(ang + Math.PI / 7), y2 - len * Math.sin(ang + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderOverlay, s: number) {
  if (overlay === "none") return;
  ctx.save();

  if (overlay === "thirds") {
    const third = ((BOARD_H - 4) / 3) * s;
    const top = 2 * s;
    const w = (BOARD_W - 4) * s;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#ef4444"; ctx.fillRect(2 * s, top, w, third);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#eab308"; ctx.fillRect(2 * s, top + third, w, third);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#3b82f6"; ctx.fillRect(2 * s, top + 2 * third, w, third);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${3.4 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Attacking third", 50 * s, 26 * s);
    ctx.fillText("Middle third", 50 * s, 76 * s);
    ctx.fillText("Defensive third", 50 * s, 126 * s);
  } else if (overlay === "channels") {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(21 * s, 2 * s, 17 * s, (BOARD_H - 4) * s);
    ctx.fillRect(62 * s, 2 * s, 17 * s, (BOARD_H - 4) * s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `${3 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Wing", 11.5 * s, (BOARD_H / 2) * s);
    ctx.fillText("Half space", 29.5 * s, (BOARD_H / 2) * s);
    ctx.fillText("Centre", 50 * s, (BOARD_H / 2) * s);
    ctx.fillText("Half space", 70.5 * s, (BOARD_H / 2) * s);
    ctx.fillText("Wing", 88.5 * s, (BOARD_H / 2) * s);
  } else {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#f97316";
    ctx.fillRect(38 * s, 22 * s, 24 * s, 22 * s);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(26 * s, 2 * s, 12 * s, 20 * s);
    ctx.fillRect(62 * s, 2 * s, 12 * s, 20 * s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `${3.6 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Zone 14", 50 * s, 35 * s);
  }

  ctx.restore();
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  opts: {
    tokens: RenderToken[];
    shapes: RenderShape[];
    overlay: RenderOverlay;
    showNames: boolean;
    scale: number;
  }
) {
  const { tokens, shapes, overlay, showNames, scale: s } = opts;

  // Pitch with mown stripes
  ctx.fillStyle = "#1f8a45";
  ctx.fillRect(0, 0, BOARD_W * s, BOARD_H * s);
  ctx.fillStyle = "#1a7a3c";
  for (let y = 0; y < BOARD_H; y += 12.5) {
    ctx.fillRect(0, y * s, BOARD_W * s, 6.25 * s);
  }
  const vignette = ctx.createRadialGradient(
    (BOARD_W / 2) * s, (BOARD_H / 2) * s, 0,
    (BOARD_W / 2) * s, (BOARD_H / 2) * s, (BOARD_H / 2) * 1.1 * s
  );
  vignette.addColorStop(0.55, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, BOARD_W * s, BOARD_H * s);

  // Markings
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 0.45 * s;
  ctx.strokeRect(2 * s, 2 * s, (BOARD_W - 4) * s, (BOARD_H - 4) * s);
  ctx.beginPath();
  ctx.moveTo(2 * s, (BOARD_H / 2) * s);
  ctx.lineTo((BOARD_W - 2) * s, (BOARD_H / 2) * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc((BOARD_W / 2) * s, (BOARD_H / 2) * s, 11 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(26 * s, 2 * s, 48 * s, 20 * s);
  ctx.strokeRect(38 * s, 2 * s, 24 * s, 8 * s);
  ctx.strokeRect(26 * s, (BOARD_H - 22) * s, 48 * s, 20 * s);
  ctx.strokeRect(38 * s, (BOARD_H - 10) * s, 24 * s, 8 * s);
  // Penalty arcs, corner arcs and goals — the full pitch's own "path" and
  // "goal" markings (board-model.ts), replayed through Path2D so the video
  // and the SVG board share one description of them.
  for (const m of getPitch("full").markings) {
    if (m.kind === "path" && m.d) {
      ctx.save();
      ctx.scale(s, s);
      ctx.lineWidth = 0.45;
      ctx.stroke(new Path2D(m.d));
      ctx.restore();
    } else if (m.kind === "goal") {
      ctx.save();
      ctx.fillStyle = "rgba(15,23,42,0.35)";
      ctx.fillRect(m.x! * s, m.y! * s, m.w! * s, m.h! * s);
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 0.55 * s;
      ctx.strokeRect(m.x! * s, m.y! * s, m.w! * s, m.h! * s);
      ctx.restore();
    }
  }

  drawOverlay(ctx, overlay, s);

  // Shapes
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Same spine/wave/press geometry as the SVG renderer (shape-glyph.tsx),
  // so a recording shows the curves and styles the coach drew.
  const trace = (pts: { x: number; y: number }[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
  };
  for (const sh of shapes) {
    if (sh.pts.length < 2) continue;
    const color = shapeColor(sh);
    const w = shapeWidth(sh) * (sh.kind === "shot" ? 1.7 : 1);
    const a = sh.pts[0];
    const b = sh.pts[sh.pts.length - 1];
    const spine = sh.kind === "free" ? sh.pts : arrowSpine(a, b, sh.curve);
    const path = sh.kind === "dribble" ? wavyPoints(spine) : spine;

    // Dark halo first, for contrast on the grass — as on the board.
    ctx.setLineDash(sh.kind === "pass" ? [2.4 * s, 1.6 * s] : []);
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = (w + 0.9) * s;
    trace(path);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w * s;
    trace(path);
    ctx.stroke();
    ctx.setLineDash([]);

    if (sh.kind === "press") {
      const { ticks, bar } = pressMarks(spine, shapeWidth(sh));
      ctx.lineWidth = shapeWidth(sh) * 0.9 * s;
      for (const [p, q] of [...ticks, bar]) {
        trace([p, q]);
        ctx.stroke();
      }
    } else if (sh.kind !== "free") {
      const prev = path[path.length - 2] ?? a;
      arrowHead(ctx, prev.x * s, prev.y * s, b.x * s, b.y * s, color, s * Math.max(1, w / 1.2));
    }
  }

  // Tokens
  for (const tok of tokens) drawToken(ctx, tok, showNames, s);
}

/** Pick a WebM mime type this browser can actually record. */
export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}
