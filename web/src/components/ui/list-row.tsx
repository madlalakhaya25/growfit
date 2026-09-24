import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListRowProps {
  /** Leading element — usually a `PlayerAvatar` or an icon in a shield. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Trailing content before the chevron, e.g. a Badge or a stat. */
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * A single row in a list of players, fixtures or documents — replaces most
 * of the card-grid pattern (187 `<Card` usages across the app before this)
 * for anything that's really a *list*, not a distinct object. A card still
 * makes sense for a dashboard tile; a squad of 18 players doesn't need 18
 * bordered boxes.
 */
export function ListRow({ leading, title, subtitle, trailing, href, onClick, className }: ListRowProps) {
  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug">{title}</p>
        {subtitle && (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="shrink-0 text-sm text-muted-foreground">{trailing}</div>}
      {(href || onClick) && (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </>
  );

  const rowClass = cn(
    "group flex items-center gap-3 px-1 py-3 first:pt-0 last:pb-0",
    (href || onClick) && "cursor-pointer",
    className
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(rowClass, "w-full text-left")}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

/** Wraps a set of `ListRow`s with hairline dividers between them. */
export function ListRowGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border", className)}>{children}</div>;
}
