"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import {
  interpolateFrames, totalDurationMs, getPitch,
  type Shape as ModelShape, type Frame as ModelFrame, type Token as ModelToken,
  type BoardObject, type PlayerNote,
} from "@/lib/board-model";
import { BoardScene } from "@/components/tactics/board-scene";
import { framesFromShapes } from "@/lib/play-motion";
import { playerJobs } from "@/lib/board-coaching";
import { PlayerJobsList } from "@/components/tactics/player-jobs";
import { describeStep, poseAtStep } from "@/lib/play-steps";

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
  // Step mode: one move at a time, for learning a play at your own pace. null = the free animation.
  const [step, setStep] = useState<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);

  function reset() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlaying(false);
    setStep(null);
    setTokens(baseTokens);
    setShapes(baseShapes);
  }

  function goToStep(index: number) {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlaying(false);
    const clamped = Math.max(0, Math.min(index, frames.length - 1));
    const pose = poseAtStep(baseTokens, frames, clamped);
    setStep(clamped);
    setTokens(pose.tokens);
    setShapes(pose.shapes);
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
    setStep(null);
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
          <BoardScene pitch={pitch} tokens={tokens} shapes={shapes} objects={objects} prefix="pv" themeId={data.pitchThemeId} />
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

      {step !== null && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3" data-testid="play-step">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => goToStep(step - 1)} disabled={step === 0} aria-label="Previous step" className="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="size-4" aria-hidden="true" /> Back
            </button>
            <p className="text-sm font-semibold">Step {step + 1} of {frames.length}</p>
            <button type="button" onClick={() => goToStep(step + 1)} disabled={step === frames.length - 1} aria-label="Next step" className="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted disabled:opacity-40">
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{describeStep(baseTokens, frames, step).join(" ")}</p>
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
          <button type="button" onClick={() => goToStep(step === null ? 1 : step)} disabled={playing} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted disabled:opacity-40">
            Step by step
          </button>
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
