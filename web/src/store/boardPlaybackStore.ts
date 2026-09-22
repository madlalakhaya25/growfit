"use client";
import { create } from "zustand";
import type { Frame, Shape, Token } from "@/lib/board-model";

/**
 * Slice 4 (moved last, per docs/BACKLOG.md 3.3, carefully) of
 * tactical-board.tsx's zustand migration: the animation/playback state —
 * the recorded step sequence and everything about replaying it. Moved last
 * in this group specifically because it's the state most entangled with
 * the undo/history system and the canvas recorder, so it had the most to
 * silently break.
 *
 * Same authStore.ts convention as the sibling board stores: no middleware,
 * flat interface, state and actions together.
 */

/** What the pitch renders during playback/scrub-preview: read-only, never
 * touches boardStore's `state` or undo history directly. Equipment doesn't
 * move during playback, so this only ever carries tokens/shapes. */
export interface AnimSnapshot {
  tokens: Token[];
  shapes: Shape[];
}

interface BoardPlaybackState {
  frames: Frame[];
  playing: boolean;
  /** Scrub preview: dragging the timeline sets `anim` to the interpolated
   * pose at that instant. To actually edit a step's pose, jump to it via
   * gotoFrame() in tactical-board.tsx, which commits to boardStore's
   * `state` instead. */
  scrubMs: number;
  scrubbing: boolean;
  recording: boolean;
  anim: AnimSnapshot | null;
  setFrames: (next: Frame[] | ((prev: Frame[]) => Frame[])) => void;
  setPlaying: (playing: boolean) => void;
  setScrubMs: (ms: number) => void;
  setScrubbing: (scrubbing: boolean) => void;
  setRecording: (recording: boolean) => void;
  setAnim: (anim: AnimSnapshot | null) => void;
  /** Mount-time-only reset — same reasoning as the sibling board stores: a
   * zustand singleton would otherwise carry a previous mount's recorded
   * steps/playback state into a freshly-loaded board. */
  reset: () => void;
}

export const useBoardPlaybackStore = create<BoardPlaybackState>()((set) => ({
  frames: [],
  playing: false,
  scrubMs: 0,
  scrubbing: false,
  recording: false,
  anim: null,
  setFrames: (next) =>
    set((s) => ({ frames: typeof next === "function" ? (next as (prev: Frame[]) => Frame[])(s.frames) : next })),
  setPlaying: (playing) => set({ playing }),
  setScrubMs: (scrubMs) => set({ scrubMs }),
  setScrubbing: (scrubbing) => set({ scrubbing }),
  setRecording: (recording) => set({ recording }),
  setAnim: (anim) => set({ anim }),
  reset: () => set({ frames: [], playing: false, scrubMs: 0, scrubbing: false, recording: false, anim: null }),
}));
