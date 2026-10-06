"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 pointer-coarse:py-3 text-xs font-medium transition-colors hover:bg-muted active:scale-95"
    >
      {copied ? (
        <Check className="size-3 text-green-500 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
      )}
      <span className="font-mono tracking-widest">{text}</span>
      {copied && <span className="text-green-600 font-sans font-normal">Copied!</span>}
    </button>
  );
}
