"use client";
import { create } from "zustand";
import type { SavedPlaySummary, LinkTarget } from "@/app/actions/tactic-plays";

/**
 * Slice 3 of tactical-board.tsx's zustand migration (docs/BACKLOG.md 3.3):
 * the saved-plays panel's own state — the play list itself, the
 * currently-open play's name/id, and its tagging/linking metadata (which
 * concepts it's tagged with, which session/fixture it's linked to, and the
 * list's own concept filter). Sets up the saved-plays panel extraction
 * that follows this slice.
 *
 * Deliberately does NOT include `busy`/`notice`: those look like
 * saved-plays-panel state at a glance, but are actually used board-wide
 * (animation capture, recording, AI describe/analyse, substitutions, pitch
 * switching all set them too) — moving them here would misrepresent their
 * real scope for the panel extractions still to come. They stay local
 * useState in tactical-board.tsx.
 *
 * Same authStore.ts convention as boardStore.ts/boardSetupStore.ts:
 * create<State>()((set) => ({...})), flat interface, no middleware.
 */

interface SavedPlaysState {
  plays: SavedPlaySummary[];
  playName: string;
  currentPlayId: string | null;
  conceptIds: string[];
  sessionId: string;
  fixtureId: string;
  targets: { sessions: LinkTarget[]; fixtures: LinkTarget[] };
  filterConcept: string;
  setPlays: (plays: SavedPlaySummary[]) => void;
  setPlayName: (name: string) => void;
  setCurrentPlayId: (id: string | null) => void;
  setConceptIds: (next: string[] | ((prev: string[]) => string[])) => void;
  setSessionId: (id: string) => void;
  setFixtureId: (id: string) => void;
  setTargets: (targets: { sessions: LinkTarget[]; fixtures: LinkTarget[] }) => void;
  setFilterConcept: (concept: string) => void;
  /**
   * Mount-time-only reset of the currently-open play and its tagging —
   * same reasoning as the other board-related stores' reset actions: a
   * zustand singleton would otherwise carry a previous mount's open play
   * into a freshly-loaded board. `plays`/`targets` aren't reset here since
   * tactical-board.tsx's own `[teamId]` effect already re-fetches both on
   * every mount, the same way it already did before this migration.
   */
  resetPanel: () => void;
}

export const useSavedPlaysStore = create<SavedPlaysState>()((set) => ({
  plays: [],
  playName: "",
  currentPlayId: null,
  conceptIds: [],
  sessionId: "",
  fixtureId: "",
  targets: { sessions: [], fixtures: [] },
  filterConcept: "",
  setPlays: (plays) => set({ plays }),
  setPlayName: (playName) => set({ playName }),
  setCurrentPlayId: (currentPlayId) => set({ currentPlayId }),
  setConceptIds: (next) =>
    set((s) => ({ conceptIds: typeof next === "function" ? (next as (prev: string[]) => string[])(s.conceptIds) : next })),
  setSessionId: (sessionId) => set({ sessionId }),
  setFixtureId: (fixtureId) => set({ fixtureId }),
  setTargets: (targets) => set({ targets }),
  setFilterConcept: (filterConcept) => set({ filterConcept }),
  resetPanel: () =>
    set({
      playName: "", currentPlayId: null, conceptIds: [], sessionId: "", fixtureId: "", filterConcept: "",
    }),
}));
