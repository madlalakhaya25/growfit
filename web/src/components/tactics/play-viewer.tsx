"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw } from "lucide-react";
import { BOARD_W as W, BOARD_H as H, BOARD_GROUP_COLOR } from "@/lib/board-render";
import { framesFromShapes } from "@/lib/play-motion";

// Read-only mirror of the board's data shape (see components/tactics/tactical-board).
interface VToken { id: string; label: string; x: number; y: number; kind: "player" | "opponent" | "ball"; group: string }
interface VShape { id: string; kind: "run" | "pass" | "dribble" | "free"; pts: { x: number; y: number }[] }
interface VFrame { id: string; tokens: { id: string; x: number; y: number }[]; shapes: VShape[] }
export interface PlayData { tokens?: VToken[]; shapes?: VShape[]; frames?: VFrame[] }

const STROKE: Record<VShape["kind"], string> = {
  run: "#fde047", pass: "#fde047", dribble: "#38bdf8", free: "#f472b6",
};

function dribblePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return `M${x1},${y1}`;
  const px = -dy / len, py = dx / len;
  const n = Math.max(2, Math.round(len / 3.2));
  let d = `M${x1},${y1}`;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (i % 2 === 0 ? 1 : -1) * 1.5;
    d += ` L${(x1 + dx * t + px * off).toFixed(2)},${(y1 + dy * t + py * off).toFixed(2)}`;
  }
  return d + ` L${x2},${y2}`;
}

export function PlayViewer({ data }: { data: PlayData }) {
  const baseTokens = data.tokens ?? [];
  const baseShapes = data.shapes ?? [];
  // Plays saved before arrows drove movement have no captured steps — derive the
  // sequence from what the coach drew so they still animate.
  const stored = data.frames ?? [];
  const frames: VFrame[] =
    stored.length >= 2
      ? stored
      : (framesFromShapes(baseTokens, baseShapes) as VFrame[]);

  const [tokens, setTokens] = useState<VToken[]>(baseTokens);
  const [shapes, setShapes] = useState<VShape[]>(baseShapes);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);

  function reset() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlaying(false);
    setTokens(baseTokens);
    setShapes(baseShapes);
  }

  function play() {
    if (frames.length < 2) return;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    setPlaying(true);

    const SEG = 1100;
    const total = SEG * (frames.length - 1);
    const started = performance.now();
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const tick = (now: number) => {
      const elapsed = Math.min(now - started, total);
      const seg = Math.min(Math.floor(elapsed / SEG), frames.length - 2);
      const local = ease(Math.min((elapsed - seg * SEG) / SEG, 1));
      const from = frames[seg], to = frames[seg + 1];

      setTokens(baseTokens.map((t) => {
        const a = from.tokens.find((f) => f.id === t.id);
        const b = to.tokens.find((f) => f.id === t.id);
        if (!a || !b) return t;
        return { ...t, x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
      }));
      setShapes(to.shapes ?? []);

      if (now - started < total) raf.current = requestAnimationFrame(tick);
      else { raf.current = null; setPlaying(false); }
    };
    raf.current = requestAnimationFrame(tick);
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-md">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full select-none">
            <defs>
              <marker id="pv-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
              </marker>
              <pattern id="pv-stripe" width={100} height={12.5} patternUnits="userSpaceOnUse">
                <rect width={100} height={12.5} fill="#15803d" />
                <rect width={100} height={6.25} fill="#166f36" />
              </pattern>
            </defs>

            <rect x={0} y={0} width={W} height={H} fill="url(#pv-stripe)" />

            <g stroke="rgba(255,255,255,0.55)" strokeWidth={0.5} fill="none">
              <rect x={2} y={2} width={W - 4} height={H - 4} rx={1} />
              <line x1={2} y1={H / 2} x2={W - 2} y2={H / 2} />
              <circle cx={W / 2} cy={H / 2} r={11} />
              <rect x={26} y={2} width={48} height={20} />
              <rect x={38} y={2} width={24} height={8} />
              <rect x={26} y={H - 22} width={48} height={20} />
              <rect x={38} y={H - 10} width={24} height={8} />
            </g>

            {shapes.map((sh) => {
              const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
              if (!a || !b) return null;
              const common = { stroke: STROKE[sh.kind], strokeWidth: 1.2, fill: "none", strokeLinecap: "round" as const };
              if (sh.kind === "free") {
                return <path key={sh.id} d={sh.pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")} {...common} />;
              }
              if (sh.kind === "dribble") {
                return <path key={sh.id} d={dribblePath(a.x, a.y, b.x, b.y)} markerEnd="url(#pv-arrow)" {...common} />;
              }
              return (
                <line key={sh.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  strokeDasharray={sh.kind === "pass" ? "3 2" : undefined}
                  markerEnd="url(#pv-arrow)" {...common} />
              );
            })}

            {tokens.map((tok) => (
              <g key={tok.id} transform={`translate(${tok.x} ${tok.y})`}>
                {tok.kind === "ball" ? (
                  <circle r={2.4} fill="#f8fafc" stroke="#111" strokeWidth={0.4} />
                ) : (
                  <>
                    <circle r={4.2} fill={BOARD_GROUP_COLOR[tok.group] ?? "#22c55e"}
                      stroke={tok.kind === "opponent" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.35)"} strokeWidth={0.5} />
                    {tok.kind === "opponent" && tok.label && (
                      <text y={1.2} textAnchor="middle" fontSize={3.4} fill="#fff" fontWeight="bold">{tok.label}</text>
                    )}
                    {tok.kind === "player" && tok.label && (
                      <text y={7.6} textAnchor="middle" fontSize={3} fill="#fff"
                        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 0.5 }}>
                        {tok.label}
                      </text>
                    )}
                  </>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>

      {frames.length >= 2 ? (
        <div className="flex justify-center gap-2">
          {playing ? (
            <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              <Square className="size-4" aria-hidden="true" /> Stop
            </button>
          ) : (
            <button type="button" onClick={play} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              <Play className="size-4" aria-hidden="true" /> Play the move
            </button>
          )}
          <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
            <RotateCcw className="size-4" aria-hidden="true" /> Reset
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">This play is a still diagram — no movement to play back.</p>
      )}
    </div>
  );
}
