"use client";

import { useId, useSyncExternalStore } from "react";
import { Video } from "lucide-react";
import { canSaveVideo } from "@/lib/board-video";

const noSubscribe = () => () => {};

export interface SaveVideoButtonProps {
  onSave: () => void;
  recording: boolean;
  /** Nothing to record yet — greyed out without a message. */
  disabled?: boolean;
  /** Why the move can't be saved right now (e.g. a training grid), or null. */
  blockedReason?: string | null;
}

/** "Save as video": saves the move as a portrait MP4 for WhatsApp (a WebM where the browser cannot make one). Disabled, with a
 * short reason, when the browser can't record or the board isn't ready. */
export function SaveVideoButton({ onSave, recording, disabled: empty, blockedReason }: Readonly<SaveVideoButtonProps>) {
  // Server render can't know; the browser answers on hydration.
  const supported = useSyncExternalStore(noSubscribe, canSaveVideo, () => false);
  const reason = supported ? blockedReason ?? null : "Your browser can't save video. Try Chrome, Edge or Firefox.";
  const reasonId = useId();
  const disabled = Boolean(empty) || recording || reason !== null;

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        aria-describedby={reason ? reasonId : undefined}
        className="inline-flex h-11 sm:h-10 items-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
      >
        <Video className="size-4 text-primary" aria-hidden="true" />
        {recording ? "Saving video…" : "Save as video"}
      </button>
      {reason && (
        <span id={reasonId} className="text-xs text-muted-foreground">
          {reason}
        </span>
      )}
    </span>
  );
}
