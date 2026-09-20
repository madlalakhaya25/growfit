"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, UserMinus } from "lucide-react";
import { resetTeamCoachCode, removeTeamCoach } from "@/app/actions/squad";

/** The coach code for a team, with copy and rotate. */
export function CoachCodeBlock({ teamId, code }: { teamId: string; code: string | null }) {
  const [current, setCurrent] = useState(code);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function copy() {
    if (!current) return;
    void navigator.clipboard.writeText(current);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function rotate() {
    setError(null);
    start(async () => {
      try {
        const res = await resetTeamCoachCode(teamId);
        if (res.error) { setError(res.error); return; }
        setCurrent(res.coachCode ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reset the code.");
      }
    });
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">Coach code</p>
      <div className="flex items-center gap-1.5">
        <p className="font-mono font-bold tracking-widest">{current ?? "—"}</p>
        {current && (
          <>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy coach code"
              className="rounded border border-border bg-background p-1 hover:bg-muted"
            >
              {copied ? <Check className="size-3 text-primary" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={rotate}
              disabled={isPending}
              title="Generate a new code — the old one stops working"
              aria-label="Reset coach code"
              className="rounded border border-border bg-background p-1 hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${isPending ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

/** Take a coach off a team. The head coach seat passes to the next-longest serving. */
export function RemoveCoachButton({
  teamId,
  coachId,
  coachName,
}: {
  teamId: string;
  coachId: string;
  coachName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${coachName} from this team`}
        title={`Remove ${coachName}`}
        className="rounded border border-border bg-background p-1 hover:bg-muted"
      >
        <UserMinus className="size-3" aria-hidden="true" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const res = await removeTeamCoach(teamId, coachId);
              if (res.error) { setError(res.error); return; }
              setConfirming(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove the coach.");
            }
          })
        }
        className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "…" : "Remove"}
      </button>
      <button
        type="button"
        onClick={() => { setConfirming(false); setError(null); }}
        className="text-[10px] text-muted-foreground underline"
      >
        Cancel
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </span>
  );
}
