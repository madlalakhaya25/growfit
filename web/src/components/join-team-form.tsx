"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { claimTeamByCoachCode } from "@/app/actions/squad";

/**
 * Lets a coach join a team the admin already set up, using its coach code.
 * Separate from the player invite code — that one goes to the squad.
 */
export function JoinTeamForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setDone(null);

    start(async () => {
      try {
        const res = await claimTeamByCoachCode(code.trim());
        if (res.error) { setError(res.error); return; }
        setDone(
          res.already
            ? `You already coach ${res.teamName}.`
            : `You're now coaching ${res.teamName}.`
        );
        setCode("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not join that team.");
      }
    });
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-card p-4"}>
      {!compact && (
        <div className="mb-3">
          <p className="font-semibold text-sm">Join a team</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your admin gives you a 6-character coach code for each team you take.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-[10rem]">
          <label htmlFor="coach-code" className="sr-only">Coach code</label>
          <input
            id="coach-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 4KD9QP"
            maxLength={12}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !code.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <KeyRound className="size-4" aria-hidden="true" />
          {isPending ? "Joining…" : "Join team"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {done && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" /> {done}
        </p>
      )}
    </div>
  );
}
