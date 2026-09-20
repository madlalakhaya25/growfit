"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { removeOwnChildPhoto } from "@/app/actions/player-photo";

export function RemovePlayerPhotoButton({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await removeOwnChildPhoto(playerId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Photo removed");
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Remove this photo?</span>
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="font-semibold text-destructive hover:underline disabled:opacity-50"
        >
          {pending ? "Removing…" : "Yes, remove"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
      Remove photo
    </button>
  );
}
