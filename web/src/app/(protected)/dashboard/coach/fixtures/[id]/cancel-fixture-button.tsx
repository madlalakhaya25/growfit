"use client";
import { useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelFixture } from "@/app/actions/fixtures";

export function CancelFixtureButton({ fixtureId }: { fixtureId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function handleConfirm() {
    if (!reason.trim()) return;
    start(async () => {
      const res = await cancelFixture(fixtureId, reason);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Fixture cancelled");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <X className="size-4" aria-hidden="true" />
        Cancel fixture
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <label htmlFor="cancel-reason" className="text-sm font-medium">
        Why is this fixture being cancelled?
      </label>
      <textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Ground waterlogged after last night's rain"
        rows={2}
        maxLength={300}
        autoFocus
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-xs text-muted-foreground">
        Shown to parents and players in place of the match.
      </p>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || !reason.trim()}
          onClick={handleConfirm}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setOpen(false); setReason(""); }}>
          Never mind
        </Button>
      </div>
    </div>
  );
}
