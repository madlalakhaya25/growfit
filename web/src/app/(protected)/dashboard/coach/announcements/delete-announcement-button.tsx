"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAnnouncement } from "@/app/actions/announcements";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  title: string;
}

export function DeleteAnnouncementButton({ id, title }: Props) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete "${title}"?`,
      body: "Parents and players who have already seen it keep no copy, and this cannot be undone.",
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteAnnouncement(id);
    });
  }

  return (
    <>
      {dialog}
      <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label={`Delete announcement: ${title}`}
      className={cn(
        "shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100",
        pending && "opacity-50 cursor-wait"
      )}
    >
      <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </>
  );
}
