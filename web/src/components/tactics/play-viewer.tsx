"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw, MessageSquare } from "lucide-react";
import {
  GROUP_COLOR as BOARD_GROUP_COLOR,
  dribblePath, polyPath, shapeColor, shapeWidth, interpolateFrames, totalDurationMs, getPitch, resolveSpotlightCenter,
  type Shape as ModelShape, type Frame as ModelFrame, type Token as ModelToken,
  type BoardObject, type PlayerNote,
} from "@/lib/board-model";
import { PitchLayer } from "@/components/tactics/pitch-layer";
import { EquipmentLayer } from "@/components/tactics/equipment-layer";
import { framesFromShapes } from "@/lib/play-motion";

// Read-only mirror of the board's data shape (see components/tactics/tactical-board).
type VToken = ModelToken;
type VShape = ModelShape;
type VFrame = ModelFrame;
export interface PlayData {
  tokens?: VToken[];
  shapes?: VShape[];
  frames?: VFrame[];
  /** New, additive: which Pitch this play is drawn on and what training
   * equipment is placed. A play saved before these existed has neither —
   * `pitchId` defaults to the full pitch, `objects` to none, so it renders
   * exactly as it always did. */
  pitchId?: string;
  objects?: BoardObject[];
  /** New, additive: coach notes about individual players in this play. A
   * play saved before notes existed has none. */
  playerNotes?: PlayerNote[];
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
  const pitch = getPitch(data.pitchId);
  const objects = data.objects ?? [];
  const notes = data.playerNotes ?? [];

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

  /**
   * Stepping and easing come from interpolateFrames() in board-model.ts —
   * the same function the interactive board's playback and its video
   * recorder use, rather than each having its own copy of this maths (three
   * copies used to exist; a fix to one silently didn't reach the others).
   */
  function play() {
    if (frames.length < 2) return;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    setPlaying(true);

    const total = totalDurationMs(frames);
    let started: number | null = null;

    const tick = (now: number) => {
      // A rAF timestamp can predate the click, making elapsed negative.
      if (started === null) started = now;
      const elapsed = Math.min(Math.max(0, now - started), total);
      const { tokens: nextTokens, shapes: nextShapes } = interpolateFrames(baseTokens, frames, elapsed);

      setTokens(nextTokens);
      setShapes(nextShapes);

      if (now - started < total) raf.current = requestAnimationFrame(tick);
      else { raf.current = null; setPlaying(false); }
    };
    raf.current = requestAnimationFrame(tick);
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-md">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border">
          <svg viewBox={`0 0 ${pitch.w} ${pitch.h}`} className="h-full w-full select-none">
            <defs>
              <marker id="pv-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
              </marker>
            </defs>

            <PitchLayer pitch={pitch} stripeId="pv-stripe" />

            {shapes.map((sh) => {
              const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
              if (!a) return null;
              const stroke = shapeColor(sh);
              const common = { stroke, strokeWidth: shapeWidth(sh), fill: "none", strokeLinecap: "round" as const };
              if (sh.kind === "text") {
                return (
                  <text key={sh.id} x={a.x} y={a.y} fontSize={3.4} fill={stroke} textAnchor="middle"
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 0.6 }}>
                    {sh.text}
                  </text>
                );
              }
              if (sh.kind === "spotlight") {
                const c = resolveSpotlightCenter(sh, tokens) ?? a;
                return <circle key={sh.id} cx={c.x} cy={c.y} r={sh.radius ?? 8} strokeDasharray="1.5 1.2" {...common} />;
              }
              if (!b) return null;
              if (sh.kind === "free") {
                return <path key={sh.id} d={polyPath(sh.pts)} {...common} />;
              }
              if (sh.kind === "zone") {
                return <path key={sh.id} d={polyPath(sh.pts) + " Z"} {...common} fill={stroke} fillOpacity={0.18} />;
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

            <EquipmentLayer objects={objects} />

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

      {notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <MessageSquare className="size-3.5" aria-hidden="true" /> Coach's notes
          </p>
          <ul className="space-y-1">
            {notes.map((n) => {
              const player = baseTokens.find((t) => t.playerId === n.playerId);
              return (
                <li key={n.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <span className="font-semibold">{player?.label ?? "A player"}: </span>
                  {n.body}
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
