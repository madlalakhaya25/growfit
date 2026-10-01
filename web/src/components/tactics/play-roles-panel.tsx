"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { approvePlayRoles, generatePlayRoles, type PlayRolesResult } from "@/app/actions/play-roles";

/**
 * Coach side of "My job in this play". Writes each named player's job for the
 * SAVED play, shows it for a read-through, and only an explicit approval
 * releases it to the players in the play (player-facing text is never shown
 * unreviewed). Generating again for an unchanged play is free: the stored set
 * comes back.
 */
export function PlayRolesPanel({ playId, onNotice }: { playId: string; onNotice?: (m: string) => void }) {
  const [result, setResult] = useState<PlayRolesResult | null>(null);
  const [busy, setBusy] = useState<"generate" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(force = false) {
    setBusy("generate");
    setError(null);
    const res = await generatePlayRoles({ playId, force });
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setResult(res);
  }

  async function approve() {
    if (!result?.artefactId) return;
    setBusy("approve");
    setError(null);
    const res = await approvePlayRoles(result.artefactId);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setResult({ ...result, status: "approved" });
    onNotice?.("Approved. Players in this play can now see their own job.");
  }

  return (
    <div className="rounded-md border border-border bg-background p-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Player jobs (uses the saved play)</p>
        <div className="flex gap-1.5">
          {result && (
            <button
              type="button"
              onClick={() => void run(true)}
              disabled={busy !== null}
              className="h-7 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
            >
              Write again
            </button>
          )}
          {!result && (
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy !== null}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
            >
              {busy === "generate" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <UserCheck className="size-3 text-primary" aria-hidden="true" />}
              Write each player&apos;s job
            </button>
          )}
        </div>
      </div>

      {result?.roles && (
        <>
          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {result.roles.map((r) => (
              <li key={r.playerId} className="text-xs">
                <span className="font-semibold">{r.name}: </span>
                {r.text}
              </li>
            ))}
          </ul>
          {result.persisted === false && (
            <p className="text-[11px] text-muted-foreground">
              Not saved yet, so it can&apos;t be approved. This needs a database update (migration 049).
            </p>
          )}
          {result.status === "approved" ? (
            <p className="inline-flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="size-3" aria-hidden="true" /> Approved for players
            </p>
          ) : (
            result.artefactId && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void approve()}
                  disabled={busy !== null}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy === "approve" && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                  Approve for players
                </button>
                <span className="text-[11px] text-muted-foreground">Players see nothing until you approve.</span>
              </div>
            )
          )}
        </>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
