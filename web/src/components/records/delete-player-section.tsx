"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { deletePlayerRecord } from "@/app/actions/player-erasure";

export function DeletePlayerSection({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePlayerRecord(playerId, confirmName);
      // A successful delete redirects server-side and never returns here.
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
        <p className="font-semibold text-destructive">Delete this player permanently</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Removes the player&apos;s entire record — profile, ratings, attributes,
        attendance history, documents, consents, medical info, and photos.
        This cannot be undone and is not the same as removing them from a
        squad.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-destructive hover:underline"
        >
          Delete player record…
        </button>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-medium">
            Type <span className="font-mono font-semibold">{playerName}</span> to confirm
          </label>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || confirmName.trim().toLowerCase() !== playerName.trim().toLowerCase()}
              onClick={handleDelete}
              className="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmName(""); }}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
