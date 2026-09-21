"use client";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, Check } from "lucide-react";

/**
 * Copies a paste-ready reminder for a parent whose child has documents
 * outstanding (docs/BACKLOG.md 2.2). Clipboard only — deliberately not a
 * WhatsApp deep link: a stored phone number here isn't reliably in the
 * international format a `wa.me` link needs, and a confidently-wrong
 * prefilled link is worse than one extra paste into whichever app the
 * admin already has that parent's chat open in.
 */
export function ChaseMessageButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Chase message copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
    >
      {copied ? (
        <Check className="size-3.5 text-green-500" aria-hidden="true" />
      ) : (
        <MessageSquareText className="size-3.5 text-muted-foreground" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy chase message"}
    </button>
  );
}
