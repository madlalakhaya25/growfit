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
}

export function RemovePlayerButton({ playerId, playerName, teamId }: Props) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove ${playerName} from the squad?`,
      body: "They stay on the academy's books — this only takes them out of this team. You can add them back later.",
      confirmLabel: "Remove",
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
      <button
      type="button"
      onClick={handleRemove}
      disabled={pending}
      aria-label={`Remove ${playerName}`}
      className={cn(
        "shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100",
        pending && "opacity-50 cursor-wait"
      )}
    >
      <UserX className="size-4" aria-hidden="true" />
      </button>
    </>
  );
}
