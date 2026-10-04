"use client";
import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { setOfficialPositions, setPreferredPositions } from "@/app/actions/player-positions";
import {
  MAX_POSITION_SLOTS, PICKABLE_POSITIONS, positionLabel, roleLabel, rolesFor, type PositionSlot,
} from "@/lib/player-roles";

interface Props {
  playerId: string;
  /** Whose list this editor changes. */
  kind: "official" | "preferred";
  initial: PositionSlot[];
  /** The other list, shown read-only beside it ("Likes" next to "Coach"). */
  other: PositionSlot[];
}

const RANK_NAMES = ["Main", "Second", "Third"];

function describe(slots: PositionSlot[]): string {
  if (slots.length === 0) return "Not set";
  return slots.map((s) => [positionLabel(s.position), roleLabel(s.role)].filter(Boolean).join(" · ")).join(", ");
}

export function PositionsEditor({ playerId, kind, initial, other }: Props) {
  const [slots, setSlots] = useState<PositionSlot[]>(initial);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const official = kind === "official";

  function change(i: number, patch: Partial<PositionSlot>) {
    setSaved(false);
    setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function save() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await (official ? setOfficialPositions : setPreferredPositions)(playerId, slots);
      if (res?.error) setError(res.error);
      else setSaved(true);
    });
  }

  const taken = new Set(slots.map((s) => s.position));
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Positions and roles">
      <div>
        <h2 className="text-base font-semibold">{official ? "Positions and roles" : "Where I like to play"}</h2>
        <p className="text-xs text-muted-foreground">
          {official
            ? "Used for team sheets and the board. Up to three, each with a role."
            : "Your coach picks the official position. This is where you would like to play."}
        </p>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">{official ? "Likes: " : "Coach: "}</span>
        {describe(other)}
      </p>
      <ul className="space-y-2">
        {slots.map((slot, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs font-medium text-muted-foreground">{RANK_NAMES[i]}</span>
            <select
              aria-label={`${RANK_NAMES[i]} position`}
              value={slot.position}
              onChange={(e) => change(i, { position: e.target.value, role: null })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              {PICKABLE_POSITIONS.filter((p) => p.value === slot.position || !taken.has(p.value)).map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              aria-label={`${RANK_NAMES[i]} role`}
              value={slot.role ?? ""}
              onChange={(e) => change(i, { role: (e.target.value || null) as PositionSlot["role"] })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">No role</option>
              {rolesFor(slot.position).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button
              type="button"
              aria-label={`Remove ${RANK_NAMES[i].toLowerCase()} position`}
              onClick={() => { setSaved(false); setSlots((all) => all.filter((_, j) => j !== i)); }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {slots.length < MAX_POSITION_SLOTS && (
        <button
          type="button"
          onClick={() => {
            const next = PICKABLE_POSITIONS.find((p) => !taken.has(p.value));
            if (next) { setSaved(false); setSlots((all) => [...all, { position: next.value, role: null }]); }
          }}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          <Plus className="size-4" /> Add a position
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || slots.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save positions"}
        </button>
        {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><Check className="size-4" /> Saved</span>}
      </div>
    </section>
  );
}
