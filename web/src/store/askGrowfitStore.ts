"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CoachMessage, LineupStructured, MatchPlanStructured } from "@/app/actions/coach-assistant";

export type AskGrowfitOutput =
  | { kind: "lineup"; text: string; structured?: LineupStructured }
  | { kind: "plan"; text: string; structured?: MatchPlanStructured; fixtureId: string };

interface AskGrowfitState {
  teamId: string;
  messages: CoachMessage[];
  fixtureId: string;
  formation: string;
  output: AskGrowfitOutput | null;
  applied: boolean;
  setTeamId: (teamId: string) => void;
  setMessages: (messages: CoachMessage[]) => void;
  setFixtureId: (fixtureId: string) => void;
  setFormation: (formation: string) => void;
  setOutput: (output: AskGrowfitOutput | null) => void;
  setApplied: (applied: boolean) => void;
  /** What "Clear conversation" and switching team both reset. */
  clearConversation: () => void;
}

/**
 * Backs the "Ask Growfit" conversation — chat history, and any suggested
 * XI/match plan not yet applied — with sessionStorage instead of component
 * state. `Sheet` (ui/sheet.tsx) unmounts its children entirely on close, so
 * before this, every close of the sheet silently threw away the whole
 * conversation and any suggestion the coach hadn't acted on yet.
 *
 * sessionStorage, not localStorage: this is a transcript about children
 * (names, attendance, ratings) — it should survive the sheet closing, not
 * the browser tab closing.
 *
 * Deliberately diverges from the tactical board's stores (boardStore.ts and
 * siblings), which are flat `create<State>()` with no middleware and an
 * explicit mount-time reset — those want a blank slate on every visit; this
 * store's entire point is to not be one. `skipHydration` + a manual
 * `.persist.rehydrate()` call (see coach-assistant-panel.tsx) is the
 * standard SSR-safe pattern for this middleware: reading sessionStorage
 * during the initial render would make the server's render (no
 * sessionStorage) disagree with the client's, so hydration is deferred to
 * an effect instead.
 */
export const useAskGrowfitStore = create<AskGrowfitState>()(
  persist(
    (set) => ({
      teamId: "",
      messages: [],
      fixtureId: "",
      formation: "11-4-3-3",
      output: null,
      applied: false,
      setTeamId: (teamId) => set({ teamId }),
      setMessages: (messages) => set({ messages }),
      setFixtureId: (fixtureId) => set({ fixtureId }),
      setFormation: (formation) => set({ formation }),
      setOutput: (output) => set({ output }),
      setApplied: (applied) => set({ applied }),
      clearConversation: () => set({ messages: [] }),
    }),
    {
      name: "growfit-ask-growfit",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    }
  )
);
