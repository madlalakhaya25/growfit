import * as React from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * A single number with a label — "14 players", "82% attendance" — set in
 * the display face so it reads at a glance. Used in rows of 2–4 across a
 * dashboard or a player's season summary.
 */
export function StatTile({ label, value, icon: Icon, className }: StatTileProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-3 py-2.5", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <p className="font-display text-2xl leading-tight tabular-nums">{value}</p>
    </div>
  );
}
