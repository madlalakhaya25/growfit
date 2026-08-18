// Canvas renderer for the tactical board.
//
// The board is drawn as SVG in React for interactivity, but recording needs a
// canvas: MediaRecorder captures a canvas stream directly, with no per-frame
// SVG serialise/decode round-trip. This module draws the same picture with the
// 2D API so a play can be recorded as a video.

export const BOARD_W = 100;
export const BOARD_H = 150;

export const BOARD_GROUP_COLOR: Record<string, string> = {
  Goalkeeper: "#f59e0b",
  Defender: "#3b82f6",
  Midfielder: "#22c55e",
  Forward: "#ef4444",
  Opponent: "#0f172a",
  Ball: "#f8fafc",
};

export type RenderShapeKind = "run" | "pass" | "dribble" | "free";
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
}

const SHAPE_STROKE: Record<RenderShapeKind, string> = {
  run: "#fde047",
  pass: "#fde047",
  dribble: "#38bdf8",
  free: "#f472b6",
};

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
  ctx.fillStyle = "#15803d";
  ctx.fillRect(0, 0, BOARD_W * s, BOARD_H * s);
  ctx.fillStyle = "#166f36";
  for (let y = 0; y < BOARD_H; y += 12.5) {
    ctx.fillRect(0, y * s, BOARD_W * s, 6.25 * s);
  }

  // Markings
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.5 * s;
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

  drawOverlay(ctx, overlay, s);

  // Shapes
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const sh of shapes) {
    if (sh.pts.length < 2) continue;
    const color = SHAPE_STROKE[sh.kind];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 * s;
    ctx.setLineDash(sh.kind === "pass" ? [3 * s, 2 * s] : []);
    const a = sh.pts[0];
    const b = sh.pts[sh.pts.length - 1];

    ctx.beginPath();
    if (sh.kind === "free") {
      sh.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * s, p.y * s) : ctx.lineTo(p.x * s, p.y * s)));
    } else if (sh.kind === "dribble") {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len;
      const n = Math.max(2, Math.round(len / 3.2));
      ctx.moveTo(a.x * s, a.y * s);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const off = (i % 2 === 0 ? 1 : -1) * 1.5;
        ctx.lineTo((a.x + dx * t + px * off) * s, (a.y + dy * t + py * off) * s);
      }
      ctx.lineTo(b.x * s, b.y * s);
    } else {
      ctx.moveTo(a.x * s, a.y * s);
      ctx.lineTo(b.x * s, b.y * s);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (sh.kind !== "free") {
      const prev = sh.pts.length > 2 ? sh.pts[sh.pts.length - 2] : a;
      arrowHead(ctx, prev.x * s, prev.y * s, b.x * s, b.y * s, color, s);
    }
  }

  // Tokens
  for (const tok of tokens) {
    const cx = tok.x * s, cy = tok.y * s;
    if (tok.kind === "ball") {
      ctx.beginPath();
      ctx.arc(cx, cy, 2.4 * s, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.lineWidth = 0.4 * s;
      ctx.strokeStyle = "#111";
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 4.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = BOARD_GROUP_COLOR[tok.group] ?? "#22c55e";
    ctx.fill();
    ctx.lineWidth = 0.5 * s;
    ctx.strokeStyle = tok.kind === "opponent" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.35)";
    ctx.stroke();

    ctx.textAlign = "center";
    if (tok.kind === "opponent" && tok.label) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${3.4 * s}px sans-serif`;
      ctx.fillText(tok.label, cx, cy + 1.2 * s);
    } else if (tok.kind === "player" && showNames && tok.label) {
      ctx.font = `${3 * s}px sans-serif`;
      ctx.lineWidth = 0.5 * s;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(tok.label, cx, cy + 7.6 * s);
      ctx.fillStyle = "#fff";
      ctx.fillText(tok.label, cx, cy + 7.6 * s);
    }
  }
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
