import { CheckCircle2, CircleAlert, XCircle, Gauge } from "lucide-react";
import type { BoardVerdict, VerdictLevel } from "@/lib/board-verdict";

const ICON = { good: CheckCircle2, risky: CircleAlert, poor: XCircle } as const;
const TONE: Record<VerdictLevel, string> = { good: "text-success", risky: "text-warning", poor: "text-destructive" };
const WORD: Record<VerdictLevel, string> = { good: "Looks on", risky: "Risky", poor: "Unlikely" };

/**
 * "Will it work?": each pass and run on the board read for whether it is
 * likely to come off (lib/board-verdict.ts). The level is spelled out in words
 * as well as the icon, so it never relies on colour alone.
 */
export function VerdictList({ verdict, className = "" }: Readonly<{ verdict: BoardVerdict; className?: string }>) {
  return (
    <div className={`space-y-2 rounded-lg border border-border bg-card p-3 ${className}`} data-testid="board-verdict">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Gauge className="size-3.5" aria-hidden="true" /> Will it work?
      </p>
      {verdict.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Draw a pass or a run from a player and it is read here: is the lane open, is the receiver onside, who gets there first.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {verdict.good} look on, {verdict.risky} risky, {verdict.poor} unlikely.
          </p>
          <ul className="space-y-1.5">
            {verdict.items.map((v) => {
              const Icon = ICON[v.level];
              return (
                <li key={v.shapeId} className="flex items-start gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                  <Icon className={`mt-0.5 size-3.5 shrink-0 ${TONE[v.level]}`} aria-hidden="true" />
                  <span>
                    <span className={`font-semibold ${TONE[v.level]}`}>{WORD[v.level]}.</span> {v.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
