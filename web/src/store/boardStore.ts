"use client";
import { create } from "zustand";
import type { BoardObject, PlayerNote, Shape, Token } from "@/lib/board-model";

/**
 * The tactical board's live drawing state: placed tokens, drawn shapes,
 * placed equipment, and per-player notes — plus `draft`, the freehand
 * shape currently being drawn (not yet committed to `shapes`). This is the
 * first slice pulled out of tactical-board.tsx's 30+ useState hooks
 * (docs/BACKLOG.md 3.3), picked first because it's the piece of state most
 * likely to be read by a future panel extracted from the same component.
 *
 * Follows authStore.ts's exact convention: `create<State>()((set) => ({...}))`,
 * a flat interface with state and actions together, no middleware.
 */
export interface BoardState {
  tokens: Token[];
  shapes: Shape[];
  /** Placed training equipment — new, additive. A play saved before this
   * existed has none, and every reader treats that the same as []. */
  objects: BoardObject[];
  /** Coach notes about individual players — new, additive, same reasoning
   * as objects above. */
  playerNotes: PlayerNote[];
}

export const EMPTY_BOARD_STATE: BoardState = { tokens: [], shapes: [], objects: [], playerNotes: [] };

interface BoardStoreState {
  state: BoardState;
  draft: Shape | null;
  setState: (next: BoardState | ((prev: BoardState) => BoardState)) => void;
  setDraft: (next: Shape | null | ((prev: Shape | null) => Shape | null)) => void;
  /**
   * Resets to a blank board — called once when TacticalBoard mounts, the
   * same guarantee plain `useState` gave for free (a fresh component
   * instance always started blank). Needed here specifically because a
   * zustand store is a module-level singleton that outlives the component:
   * without this, navigating away from the board and back would show the
   * previous visit's tokens instead of a blank pitch.
   */
  reset: () => void;
}

export const useBoardStore = create<BoardStoreState>()((set) => ({
  state: EMPTY_BOARD_STATE,
  draft: null,
  setState: (next) =>
    set((s) => ({
      state: typeof next === "function" ? (next as (prev: BoardState) => BoardState)(s.state) : next,
    })),
  setDraft: (next) =>
    set((s) => ({
      draft: typeof next === "function" ? (next as (prev: Shape | null) => Shape | null)(s.draft) : next,
    })),
  reset: () => set({ state: EMPTY_BOARD_STATE, draft: null }),
}));
