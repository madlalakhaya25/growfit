"use client";
import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { dismissAnnouncement } from "@/app/actions/announcements";
import { cn } from "@/lib/utils";

export function DismissAnnouncementButton({
  id,
  acknowledged = false,
}: {
  id: string;
  acknowledged?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleAcknowledge(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (acknowledged) return;
    startTransition(async () => {
      await dismissAnnouncement(id);
    });
  }

  if (acknowledged) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 shrink-0">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Got it
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAcknowledge}
      disabled={pending}
      aria-label="Acknowledge announcement"
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        "text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pending && "opacity-50 cursor-wait"
      )}
    >
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      Got it
    </button>
  );
}
