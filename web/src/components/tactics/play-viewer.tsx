"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw, MessageSquare } from "lucide-react";
import {
  interpolateFrames, totalDurationMs, getPitch,
  type Shape as ModelShape, type Frame as ModelFrame, type Token as ModelToken,
  type BoardObject, type PlayerNote,
} from "@/lib/board-model";
import { PitchLayer } from "@/components/tactics/pitch-layer";
import { TokenDefs, TokenGlyph } from "@/components/tactics/token-glyph";
import { ShapeDefs, ShapeGlyph } from "@/components/tactics/shape-glyph";
import { EquipmentLayer } from "@/components/tactics/equipment-layer";
import { framesFromShapes } from "@/lib/play-motion";
import { playerJobs } from "@/lib/board-coaching";
import { PlayerJobsList } from "@/components/tactics/player-jobs";

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
  /** New, additive: the coach's pitch theme (lib/pitch-themes.ts). */
  pitchThemeId?: string;
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
  // Our players' jobs only: a shared play is for our squad, and what the
  // opponent does is the coach's framing, not an instruction to anyone.
  const jobs = playerJobs(baseTokens, baseShapes, pitch).filter((j) => j.side === "player");

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
        {/* Aspect ratio driven off the play's own Pitch — a hardcoded 2:3
            here would letterbox anything but the full pitch, and (since
            interactive scrub/click coordinates elsewhere assume the
            viewBox fills this box exactly) is the kind of mismatch that
            also throws off coordinates, not just the visual frame. */}
        <div className="w-full overflow-hidden rounded-xl border border-border" style={{ aspectRatio: `${pitch.w} / ${pitch.h}` }}>
          <svg viewBox={`0 0 ${pitch.w} ${pitch.h}`} className="h-full w-full select-none">
            <ShapeDefs prefix="pv" />

            <PitchLayer pitch={pitch} stripeId="pv-stripe" themeId={data.pitchThemeId} />
            <TokenDefs prefix="pv-tok" />

            {shapes.map((sh) => <ShapeGlyph key={sh.id} sh={sh} prefix="pv" tokens={tokens} />)}

            <EquipmentLayer objects={objects} />

            {tokens.map((tok) => (
              <g key={tok.id} transform={`translate(${tok.x} ${tok.y})`}>
                <TokenGlyph tok={tok} prefix="pv-tok" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <MessageSquare className="size-3.5" aria-hidden="true" /> Coach&apos;s notes
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

      {jobs.length > 0 && <PlayerJobsList jobs={jobs} />}

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
