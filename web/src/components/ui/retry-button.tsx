"use client";
import { Button } from "@/components/ui/button";

/**
 * A plain reload trigger for a server-rendered section that failed to load.
 * These pages have no client-side data-fetching to re-run, so "retry" means
 * asking the server for the page again — the same thing the browser's own
 * reload does, just reachable from inside the error card itself.
 */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
