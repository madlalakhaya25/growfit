import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A pill that turns one filter on or off, with an optional count. One row of
 * these sits under a list's search box; the one that's on is filled black, so
 * it never competes with the screen's one red action.
 *
 * 32 px tall with a mouse and 44 px on a touch screen, like Button's `sm`.
 * A filter that would match nobody is disabled rather than hidden, so the
 * row doesn't change shape and "nobody is below 75%" still reads as an answer.
 */
export function FilterChip({
  active,
  count,
  className,
  children,
  ...props
}: Readonly<Omit<ComponentProps<"button">, "type"> & { active: boolean; count?: number }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors pointer-coarse:h-11 pointer-coarse:px-4 pointer-coarse:text-sm",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular-nums", !active && "text-muted-foreground")}>{count}</span>
      )}
    </button>
  );
}

/**
 * "Showing 6 of 45 players", with a link to clear the filter. Shown only while
 * a search or filter is narrowing the list, so the full list needs no caption.
 */
export function ResultCount({
  shown,
  total,
  noun,
  clearHref,
  className,
}: Readonly<{ shown: number; total: number; noun: [singular: string, plural: string]; clearHref: string; className?: string }>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} aria-live="polite">
      Showing {shown} of {total} {total === 1 ? noun[0] : noun[1]}.{" "}
      <Link href={clearHref} className="font-medium text-primary hover:underline">
        Clear
      </Link>
    </p>
  );
}
