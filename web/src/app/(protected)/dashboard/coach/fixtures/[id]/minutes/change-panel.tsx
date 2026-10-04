"use client";

import { ArrowDown, ArrowUp, BellRing, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/playing-time";
import type { Change, NextChangeInfo } from "@/lib/playing-time-live";

interface ChangePanelProps {
  info: NextChangeInfo;
  /** The change the coach will make: the suggestion, or their own edit of it. */
  change: Change;
  onPitch: string[];
  bench: string[];
  /** A fixed keeper, who is never offered to come off. */
  keeperId: string | null;
  names: Map<string, string>;
  canUndo: boolean;
  onToggle: (side: "off" | "on", id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
  onUndo: () => void;
}

function Heading({ info }: Readonly<{ info: NextChangeInfo }>) {
  if (info.atHalfTime) return <>Half-time change</>;
  if (info.due) return <>Change due now</>;
  if (info.secondsUntil !== null) {
    return (
      <>
        Next change in <span className="tabular-nums">{formatClock(info.secondsUntil)}</span>
      </>
    );
  }
  return <>No more planned changes this half</>;
}

function Chips({
  ids,
  picked,
  side,
  names,
  onToggle,
}: Readonly<{ ids: string[]; picked: string[]; side: "off" | "on"; names: Map<string, string>; onToggle: (side: "off" | "on", id: string) => void }>) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const active = picked.includes(id);
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(side, id)}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors",
                active && side === "off" && "border-destructive bg-destructive/10 text-destructive",
                active && side === "on" && "border-success bg-success/10 text-success",
                !active && "border-border bg-card",
              )}
            >
              {names.get(id) ?? "Player"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The upcoming change: who comes off, who goes on. Pre-filled with the fair
 * suggestion; tap names to swap who. Confirm is only live when the numbers match.
 */
export function ChangePanel(props: Readonly<ChangePanelProps>) {
  const { info, change, onPitch, bench, keeperId, names, canUndo, onToggle, onConfirm, onSkip, onUndo } = props;
  const balanced = change.off.length > 0 && change.off.length === change.on.length;
  const offChoices = onPitch.filter((id) => id !== keeperId);

  return (
    <Card
      className={cn(
        "space-y-4 p-4 transition-colors",
        info.due && "border-warning bg-warning/10 ring-2 ring-warning motion-safe:animate-pulse",
      )}
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-lg font-bold">
        {info.due && <BellRing className="size-5 text-warning" aria-hidden="true" />}
        <Heading info={info} />
      </p>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <ArrowDown className="size-4" aria-hidden="true" />
          Coming off
        </p>
        <Chips ids={offChoices} picked={change.off} side="off" names={names} onToggle={onToggle} />
      </div>
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <ArrowUp className="size-4" aria-hidden="true" />
          Going on
        </p>
        {bench.length > 0 ? (
          <Chips ids={bench} picked={change.on} side="on" names={names} onToggle={onToggle} />
        ) : (
          <p className="text-sm text-muted-foreground">Nobody on the bench.</p>
        )}
      </div>

      {!balanced && change.off.length + change.on.length > 0 && (
        <p className="text-xs text-muted-foreground">Pick the same number coming off as going on.</p>
      )}

      <Button block size="lg" disabled={!balanced} onClick={onConfirm}>
        Make the change
      </Button>
      <div className="flex gap-2">
        {info.segmentIndex !== null && (
          <Button variant="ghost" size="md" className="flex-1" onClick={onSkip}>
            Skip this change
          </Button>
        )}
        {canUndo && (
          <Button variant="ghost" size="md" className="flex-1" onClick={onUndo}>
            <Undo2 aria-hidden="true" />
            Undo last change
          </Button>
        )}
      </div>
    </Card>
  );
}
