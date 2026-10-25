"use client";
import { useTransition } from "react";
import { UserX } from "lucide-react";
import { toast } from "sonner";
import { removePlayerFromSquad } from "@/app/actions/squad";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface Props {
  playerId: string;
  playerName: string;
  teamId: string;
  /**
   * "row": an icon that appears on hover, for the squad list, and only with a
   * mouse. On a touch screen it was invisible but still tappable, a 28 px
   * destructive target at the card's edge; there the player's page has it.
   * "page": a labelled button, for the player's page.
   */
  variant?: "row" | "page";
}

export function RemovePlayerButton({ playerId, playerName, teamId, variant = "row" }: Props) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove ${playerName} from the squad?`,
      body: "They stay on the academy's books — this only takes them out of this team. You can add them back later.",
      confirmLabel: "Remove from squad",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await removePlayerFromSquad(playerId, teamId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`${playerName} removed from squad`);
      }
    });
  }

  return (
    <>
      {dialog}
      {variant === "page" ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 pointer-coarse:h-11",
            pending && "opacity-50 cursor-wait"
          )}
        >
          <UserX className="size-4" aria-hidden="true" />
          Remove from squad
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          aria-label={`Remove ${playerName}`}
          className={cn(
            "hidden size-9 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity pointer-fine:grid group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100",
            pending && "opacity-50 cursor-wait"
          )}
        >
          <UserX className="size-4" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
