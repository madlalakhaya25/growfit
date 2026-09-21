import Link from "next/link";
import { HeartPulse, ChevronRight } from "lucide-react";

/**
 * One-line welfare signal for the coach dashboard.
 *
 * The full check-in list used to sit here, expanded, above everything else.
 * This keeps the count visible the moment a coach opens the app without
 * putting a standing list of children between them and Sunday's fixture.
 *
 * Renders nothing when there is nothing to report — a permanent "0 alerts"
 * row would be exactly the always-there noise this change is removing.
 */
export function WelfareSummaryLink({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Link
      href="/dashboard/coach/welfare"
      className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 transition-colors hover:bg-amber-500/10"
    >
      <HeartPulse
        className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {count} welfare check-in{count === 1 ? "" : "s"} needed
        </span>
        <span className="block text-xs text-muted-foreground">
          Below the 75% training attendance threshold
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
