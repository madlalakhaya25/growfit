"use client";

import type { ReactNode } from "react";
import { ChevronDown, PenLine, Route, Sparkles, Users, type LucideIcon } from "lucide-react";

export type DockTab = "players" | "draw" | "move" | "ai";

export const DOCK_TABS: readonly { id: DockTab; label: string; Icon: LucideIcon }[] = [
  { id: "players", label: "Players", Icon: Users },
  { id: "draw", label: "Draw", Icon: PenLine },
  { id: "move", label: "Move", Icon: Route },
  { id: "ai", label: "Coach AI", Icon: Sparkles },
];

/** The panel that is open: the coach's own choice, else Players on a blank
 * board (setting up is the first job) and nothing once players are placed. */
export function openDockTab(choice: DockTab | "closed" | undefined, hasPlayers: boolean): DockTab | null {
  if (choice === "closed") return null;
  if (choice) return choice;
  return hasPlayers ? null : "players";
}

/** Tapping the open tab closes it; tapping another opens that one. */
export function nextDockChoice(open: DockTab | null, tapped: DockTab): DockTab | "closed" {
  return open === tapped ? "closed" : tapped;
}

/** Four buttons that each open one group of board tools. Every tool stays on
 * the board; the dock only decides which group is showing. */
export function BoardDock({ open, onChange }: Readonly<{ open: DockTab | null; onChange: (tab: DockTab) => void }>) {
  return (
    <nav aria-label="Board tools" className="grid grid-cols-4 gap-0.5 rounded-[12px] bg-secondary p-0.5">
      {DOCK_TABS.map(({ id, label, Icon }) => {
        const active = open === id;
        return (
          <button
            key={id}
            type="button"
            aria-expanded={active}
            aria-controls={`dock-${id}`}
            onClick={() => onChange(id)}
            className={`flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] px-0.5 text-[12px] sm:gap-1.5 sm:text-[13px] font-medium transition-colors ${
              active ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            <ChevronDown className={`hidden size-3.5 transition-transform sm:block ${active ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

/** One group of tools. It stays mounted when closed, so what a coach has
 * typed or chosen inside it is still there when they come back. */
export function DockPanel({ id, open, children }: Readonly<{ id: DockTab; open: DockTab | null; children: ReactNode }>) {
  return (
    <section id={`dock-${id}`} className={open === id ? "space-y-3" : "hidden"}>
      {children}
    </section>
  );
}
