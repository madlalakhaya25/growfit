"use client";
import { create } from "zustand";
import type { EquipmentKind } from "@/lib/board-model";

/**
 * Slice 2 of tactical-board.tsx's zustand migration (docs/BACKLOG.md 3.3):
 * which team/formations/pitch/equipment tool the board is currently set up
 * for. Follows authStore.ts's exact convention: create<State>()((set) =>
 * ({...})), flat interface, no middleware — same as boardStore.ts (slice
 * 1).
 */

export const DEFAULT_HOME_FORMATION_ID = "11-4-3-3";
export const DEFAULT_AWAY_FORMATION_ID = "11-4-4-2";
export const DEFAULT_PITCH_ID = "full";
export const DEFAULT_EQUIPMENT_KIND: EquipmentKind = "cone";

interface BoardSetupState {
  teamId: string;
  homeFormationId: string;
  awayFormationId: string;
  pitchId: string;
  equipmentKind: EquipmentKind;
  /** How the pitch is painted (lib/pitch-themes.ts) — saved with a play
   * so the shared view looks like the board the coach drew on. */
  pitchThemeId: string;
  setPitchThemeId: (id: string) => void;
  setTeamId: (id: string) => void;
  setHomeFormationId: (id: string) => void;
  setAwayFormationId: (id: string) => void;
  setPitchId: (id: string) => void;
  setEquipmentKind: (kind: EquipmentKind) => void;
  /**
   * Mount-time-only reset to the given team and every default, same
   * reasoning as boardStore's own reset(): a zustand store is a
   * module-level singleton that would otherwise carry the previous mount's
   * team/formation/pitch/equipment selection into a freshly-loaded board,
   * where plain useState's per-mount initializer gave a fresh start for
   * free.
   */
  resetForTeam: (teamId: string) => void;
}

export const useBoardSetupStore = create<BoardSetupState>()((set) => ({
  teamId: "",
  homeFormationId: DEFAULT_HOME_FORMATION_ID,
  awayFormationId: DEFAULT_AWAY_FORMATION_ID,
  pitchId: DEFAULT_PITCH_ID,
  equipmentKind: DEFAULT_EQUIPMENT_KIND,
  pitchThemeId: "classic",
  setPitchThemeId: (pitchThemeId) => set({ pitchThemeId }),
  setTeamId: (teamId) => set({ teamId }),
  setHomeFormationId: (homeFormationId) => set({ homeFormationId }),
  setAwayFormationId: (awayFormationId) => set({ awayFormationId }),
  setPitchId: (pitchId) => set({ pitchId }),
  setEquipmentKind: (equipmentKind) => set({ equipmentKind }),
  resetForTeam: (teamId) =>
    set({
      teamId,
      homeFormationId: DEFAULT_HOME_FORMATION_ID,
      awayFormationId: DEFAULT_AWAY_FORMATION_ID,
      pitchId: DEFAULT_PITCH_ID,
      equipmentKind: DEFAULT_EQUIPMENT_KIND,
      pitchThemeId: "classic",
    }),
}));
