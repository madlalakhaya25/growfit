"use client";
import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { addPlayerToSquad, createPlayer } from "@/app/actions/squad";
import { POSITIONS, FEET, AGE_GROUPS } from "@/lib/types";
import { calculateAge, getInitials } from "@/lib/player";

type Player = {
  id: string;
  full_name: string;
  position: string | null;
  date_of_birth: string | null;
  preferred_foot: string | null;
};

const TABS = ["Find existing", "Create new"] as const;

export function AddPlayerTabs({ available, teamId }: { available: Player[]; teamId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Find existing");
  const router = useRouter();

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex rounded-lg border border-border bg-muted p-1 w-fit gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Find existing" ? (
        <SearchTab players={available} teamId={teamId} onBack={() => router.push(`/dashboard/coach/squad?team=${teamId}`)} />
      ) : (
        <CreateTab teamId={teamId} />
      )}
    </div>
  );
}

function SearchTab({ players, teamId, onBack }: { players: Player[]; teamId: string; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [adding, startAdd] = useTransition();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(query.toLowerCase())
  );

  function handleAdd(id: string) {
    startAdd(async () => {
      const res = await addPlayerToSquad(id, teamId);
      if (!res?.error) setAddedIds((prev) => new Set([...prev, id]));
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {players.length === 0 ? "All academy players are already in your squad." : "No players match your search."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((p) => {
            const added = addedIds.has(p.id);
            const age = calculateAge(p.date_of_birth);
            const posLabel = POSITIONS.find((pos) => pos.value === p.position)?.label;
            const initials = getInitials(p.full_name);

            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-primary">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {posLabel && <Badge variant="neutral" className="text-xs">{posLabel}</Badge>}
                    {age && <Badge variant="neutral" className="text-xs">Age {age}</Badge>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={added ? "secondary" : "primary"}
                  disabled={added || adding}
                  onClick={() => handleAdd(p.id)}
                >
                  {added ? (
                    <><Check className="size-3.5" aria-hidden="true" /> Added</>
                  ) : (
                    <><UserPlus className="size-3.5" aria-hidden="true" /> Add</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Button variant="outline" onClick={onBack}>Back to squad</Button>
    </div>
  );
}

function CreateTab({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await createPlayer(formData)) ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="max-w-md space-y-5">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Full name *" name="full_name" required placeholder="e.g. Sipho Dlamini" />

      <div className="space-y-1.5">
        <label htmlFor="position" className="text-sm font-medium">Position</label>
        <select
          id="position"
          name="position"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select position…</option>
          {POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="preferred_foot" className="text-sm font-medium">Preferred foot</label>
        <select
          id="preferred_foot"
          name="preferred_foot"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select…</option>
          {FEET.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <Field label="Date of birth" name="date_of_birth" type="date" />

      {/* Attributes */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Initial attributes <span className="text-muted-foreground font-normal">(optional)</span></p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {(["pace","shooting","passing","dribbling","defending","physical"] as const).map((attr) => (
            <div key={attr} className="space-y-1">
              <label htmlFor={attr} className="text-xs font-medium capitalize text-muted-foreground">{attr}</label>
              <input
                id={attr}
                name={attr}
                type="number"
                min="0"
                max="100"
                placeholder="—"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create & add to squad"}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label, name, required, placeholder, type = "text",
}: {
  label: string; name: string; required?: boolean; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
    </div>
  );
}
