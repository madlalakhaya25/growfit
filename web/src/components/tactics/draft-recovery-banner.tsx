"use client";

import type { BoardDraft } from "@/components/tactics/tactical-board";

/**
 * "You have an unsaved board" banner — offered rather than applied
 * automatically: silently restoring over a coach who opened a blank board
 * on purpose would be its own kind of data loss. Third panel extracted out
 * of tactical-board.tsx (docs/BACKLOG.md 3.3).
 *
 * Presentational only: the draft-recovery *mechanism* (the mount-time
 * localStorage read that produces `draft`, and the debounced
 * localStorage-persist effect that writes it) stays in tactical-board.tsx,
 * per the plan's own description of this state as "a mount-time-only local
 * UI concern" — not moved to a store, not moved here either. This
 * component only renders the offer and reports which button was pressed.
 */
export interface DraftRecoveryBannerProps {
  draft: BoardDraft;
  onRestore: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryBanner({ draft, onRestore, onDiscard }: DraftRecoveryBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">You have an unsaved board</p>
        <p className="text-xs text-muted-foreground">
          {draft.playName ? `"${draft.playName}" — ` : ""}
          last edited{" "}
          {new Date(draft.savedAt).toLocaleString("en-ZA", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
          {draft.frames?.length
            ? ` · ${draft.frames.length} step${draft.frames.length === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          Restore it
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs hover:bg-muted"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
