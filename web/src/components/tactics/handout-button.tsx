"use client";

import { FileText } from "lucide-react";

/** "Handout PDF": a one-page print or WhatsApp copy of the board. */
export function HandoutButton({
  onMake, busy, disabled, blockedReason,
}: Readonly<{ onMake: () => void; busy: boolean; disabled?: boolean; blockedReason?: string | null }>) {
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={onMake}
        disabled={Boolean(disabled) || busy || Boolean(blockedReason)}
        className="inline-flex h-11 sm:h-10 items-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
      >
        <FileText className="size-4 text-primary" aria-hidden="true" />
        {busy ? "Making PDF…" : "Handout PDF"}
      </button>
      {blockedReason && <span className="text-[11px] text-muted-foreground">{blockedReason}</span>}
    </span>
  );
}
