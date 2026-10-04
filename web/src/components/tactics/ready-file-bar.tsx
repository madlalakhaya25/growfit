"use client";

import { Download, Share2, X } from "lucide-react";
import { downloadBlob } from "@/lib/board-video";
import { canShareFile, shareFile } from "@/lib/share-file";

/**
 * A finished video or handout, ready to go. The share sheet only opens from a
 * fresh tap, and making the file takes a moment, so the file waits here with
 * its own buttons instead of opening the sheet on its own.
 */
export function ReadyFileBar({
  file, onNotice, onDone,
}: Readonly<{ file: File; onNotice: (message: string) => void; onDone: () => void }>) {
  async function handleShare() {
    const result = await shareFile(file, file.name);
    if (result === "failed") onNotice("Couldn't open sharing. Use Download instead.");
    if (result === "shared") onDone();
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2 text-sm">
      <span className="min-w-0 truncate font-medium">{file.name} is ready</span>
      {canShareFile(file) && (
        <button
          type="button"
          onClick={() => { void handleShare(); }}
          className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-4 font-semibold text-primary-foreground sm:h-10"
        >
          <Share2 className="size-4" aria-hidden="true" /> Share
        </button>
      )}
      <button
        type="button"
        onClick={() => { downloadBlob(file, file.name); onDone(); }}
        className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border bg-card px-4 hover:bg-secondary sm:h-10"
      >
        <Download className="size-4" aria-hidden="true" /> Download
      </button>
      <button
        type="button"
        onClick={onDone}
        aria-label="Close"
        className="inline-flex size-11 items-center justify-center rounded-md hover:bg-secondary sm:size-10"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
