"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteFixture } from "@/app/actions/fixtures";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DeleteFixtureButton({ fixtureId }: { fixtureId: string }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  const router = useRouter();

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this fixture?",
      body: "It disappears completely — no cancellation notice to parents or players. Use Cancel fixture instead if the match is actually off. This cannot be undone.",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteFixture(fixtureId);
      if (result?.error) toast.error(result.error);
      else router.push("/dashboard/coach/fixtures");
    });
  }

  return (
    <>
      {dialog}
      {/* onInk, not outline: this sits directly on the matchday header's
          bg-ink band (page.tsx), which inverts against the page rather
          than being fixed-dark. The destructive-on-ink overrides on top
          (not the plain destructive tokens — see globals.css's comment on
          --color-destructive-on-ink) keep it reading as the dangerous
          action it is, with the correct red for whichever way the ink band
          is currently inverted, rather than blending with Edit/Cancel. */}
      <Button
        variant="onInk"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        className="border-destructive-on-ink/40 text-destructive-on-ink hover:bg-destructive-on-ink/10 hover:text-destructive-on-ink"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
        {pending ? "Deleting…" : "Delete"}
      </Button>
    </>
  );
}
