"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users, CheckCircle2, Loader2 } from "lucide-react";
import { assignPlayersToTeam } from "@/app/actions/squad";
import { POSITIONS } from "@/lib/types";
import { calculateAge } from "@/lib/player";

export interface UnassignedPlayer {
  id: string;
  full_name: string;
  position: string | null;
  date_of_birth: string | null;
  mysafa_number: string | null;
}
export interface AssignTeam { id: string; name: string; age_group: string | null }

/**
 * Players who belong to the academy but are in no squad — most often an import
 * where a team was not chosen. Nothing else in the app surfaced them, so they
 * were invisible until someone went looking.
 */
export function UnassignedPlayersPanel({
  players,
  teams,
}: {
  players: UnassignedPlayer[];
  teams: AssignTeam[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function assign() {
    if (!teamId || selected.size === 0) return;
    setError(null);
    setDone(null);
    start(async () => {
      try {
        const res = await assignPlayersToTeam({ teamId, playerIds: [...selected] });
        if (res.error) { setError(res.error); return; }
        const team = teams.find((t) => t.id === teamId);
        setDone(`${res.count} player${res.count === 1 ? "" : "s"} added to ${team?.name ?? "the squad"}.`);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add those players.");
      }
    });
  }

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium">Everyone is in a squad</p>
        <p className="text-sm text-muted-foreground mt-1">
          No players are sitting outside a team.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden="true" />
          Not in a squad ({players.length})
        </p>
        <button
          type="button"
          onClick={() => setSelected(selected.size === players.length ? new Set() : new Set(players.map((p) => p.id)))}
          className="text-xs text-muted-foreground underline"
        >
          {selected.size === players.length ? "Clear selection" : "Select all"}
        </button>
      </div>

      <ul className="divide-y divide-border">
        {players.map((p) => {
          const a = calculateAge(p.date_of_birth);
          const pos = POSITIONS.find((x) => x.value === p.position)?.label;
          return (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="size-4 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.full_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[pos ?? "No position", a ? `Age ${a}` : null, p.mysafa_number]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <select
          aria-label="Squad to add to"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {teams.length === 0 && <option value="">No teams yet</option>}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.age_group ? ` · ${t.age_group}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={isPending || selected.size === 0 || !teamId}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          {isPending ? "Adding…" : `Add ${selected.size || ""} to squad`}
        </button>
        {done && (
          <p className="flex items-center gap-1.5 text-xs text-primary">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> {done}
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
