"use client";

import { Button } from "@/components/ui/button";

/**
 * The two small notes under a stored AI result: "nothing has changed" (with a
 * way to regenerate regardless) and "couldn't be saved". Null when neither applies.
 */
export function StoredAiNotices({
  unchanged,
  unsaved,
  pending,
  onRegenerate,
}: {
  unchanged: boolean;
  unsaved: boolean;
  pending: boolean;
  onRegenerate: () => void;
}) {
  if (!unchanged && !unsaved) return null;
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {unchanged && (
        <p className="flex flex-wrap items-center gap-2">
          Nothing has changed since this was made.
          <Button type="button" size="sm" variant="ghost" onClick={onRegenerate} disabled={pending}>
            Regenerate anyway
          </Button>
        </p>
      )}
      {unsaved && <p>This couldn&apos;t be saved — an administrator needs to apply the latest database update.</p>}
    </div>
  );
}
