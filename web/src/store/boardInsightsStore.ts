"use client";
import { create } from "zustand";
import type { OpponentCounter } from "@/lib/opponent-counter";

/**
 * The board's "where's the space" overlay: whether it's showing, which
 * finding the coach has picked out of the legend, and the latest AI counter
 * for the board as it stands. Shared because the toggle and pitch live in
 * tactical-board.tsx while the AI counter is requested from the Plays panel
 * (saved-plays-panel.tsx) — same zustand convention as the other board
 * slices. Nothing here is saved with a play: it's a question the coach is
 * asking of the board, recomputed live as they move players.
 */
/** Phase 2 analysis overlays (lib/board-overlays.ts), each on or off. */
/** "times" and "jobs" are Phase 3 coaching layers (lib/board-coaching.ts). */
export type AnalysisLayer = "lanes" | "space" | "lines" | "numbers" | "times" | "jobs";
const NO_LAYERS: Record<AnalysisLayer, boolean> = { lanes: false, space: false, lines: false, numbers: false, times: false, jobs: false };

interface BoardInsightsState {
  showExploits: boolean;
  layers: Record<AnalysisLayer, boolean>;
  toggleLayer: (layer: AnalysisLayer) => void;
  focusedExploitId: string | null;
  aiCounter: OpponentCounter | null;
  setShowExploits: (show: boolean) => void;
  setFocusedExploitId: (id: string | null) => void;
  setAiCounter: (counter: OpponentCounter | null) => void;
  /** Mount-time reset, same reason as boardStore's own. */
  reset: () => void;
}

export const useBoardInsightsStore = create<BoardInsightsState>()((set) => ({
  showExploits: false,
  layers: NO_LAYERS,
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  focusedExploitId: null,
  aiCounter: null,
  setShowExploits: (showExploits) => set({ showExploits, focusedExploitId: null }),
  setFocusedExploitId: (focusedExploitId) => set({ focusedExploitId }),
  // A fresh counter always turns the overlay on — that's where it's drawn.
  setAiCounter: (aiCounter) => set(aiCounter ? { aiCounter, showExploits: true, focusedExploitId: null } : { aiCounter: null }),
  reset: () => set({ showExploits: false, layers: NO_LAYERS, focusedExploitId: null, aiCounter: null }),
}));
