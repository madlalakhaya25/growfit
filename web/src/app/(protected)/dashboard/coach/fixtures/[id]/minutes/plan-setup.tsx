"use client";

import { useState } from "react";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildRotation, PITCH_SIZES, SUB_INTERVALS, type MatchFormat } from "@/lib/playing-time";
import type { LiveConfig } from "@/lib/playing-time-live";
import type { PlannerPlayer } from "./minutes-planner";
import { Segmented, Stepper } from "./segmented";
import { PlanPreview } from "./plan-preview";

interface PlanSetupProps {
  players: PlannerPlayer[];
  defaultSelected: string[];
  defaultFormat: MatchFormat;
  onStart: (config: LiveConfig) => void;
}

const pitchOptions = PITCH_SIZES.map((n) => ({ value: n, label: `${n}-a-side` }));
const intervalOptions = SUB_INTERVALS.map((n) => ({ value: n, label: `${n} min` }));

function SquadRow({
  player,
  selected,
  starting,
  onToggle,
  onToggleStart,
}: Readonly<{ player: PlannerPlayer; selected: boolean; starting: boolean; onToggle: () => void; onToggleStart: () => void }>) {
  return (
    <li className="flex items-center gap-2 py-1">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {selected && <Check className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{player.name}</span>
          {player.unavailable && <span className="block text-xs text-muted-foreground">Marked unavailable</span>}
        </span>
      </button>
      {selected && (
        <button
          type="button"
          aria-pressed={starting}
          onClick={onToggleStart}
          className={cn(
            "min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold",
            starting ? "bg-primary/10 text-primary" : "text-muted-foreground",
          )}
        >
          {starting ? "Starts" : "Start?"}
        </button>
      )}
    </li>
  );
}

/** Pick who is here, how the match is played, and see the fair plan before kick-off. */
export function PlanSetup({ players, defaultSelected, defaultFormat, onStart }: Readonly<PlanSetupProps>) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  const [starters, setStarters] = useState<Set<string>>(() => new Set());
  const [onPitch, setOnPitch] = useState<number>(defaultFormat.onPitch);
  const [halves, setHalves] = useState(defaultFormat.halves);
  const [halfMinutes, setHalfMinutes] = useState(defaultFormat.halfMinutes);
  const [interval, setIntervalMinutes] = useState<number>(8);
  const [keeperId, setKeeperId] = useState<string>(
    () => players.find((p) => p.isKeeper && defaultSelected.includes(p.id))?.id ?? "",
  );

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const selectedPlayers = players.filter((p) => selected.has(p.id));
  const keeper = keeperId && selected.has(keeperId) ? keeperId : null;
  // Starters first, so the plan's opening line-up is the coach's pick.
  const playerIds = [
    ...selectedPlayers.filter((p) => starters.has(p.id)).map((p) => p.id),
    ...selectedPlayers.filter((p) => !starters.has(p.id)).map((p) => p.id),
  ];
  const config: LiveConfig = { playerIds, onPitch, halves, halfMinutes, intervalMinutes: interval, keeperId: keeper };
  // Cheap enough to rebuild on every tap.
  const plan = buildRotation(config);
  const names = new Map(players.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4">
        <Segmented label="Players on the pitch" options={pitchOptions} value={onPitch} onChange={setOnPitch} />
        <div className="grid grid-cols-2 gap-3">
          <Stepper label="Halves" value={halves} min={1} max={4} onChange={setHalves} />
          <Stepper label="Each half" value={halfMinutes} min={10} max={45} step={5} suffix=" min" onChange={setHalfMinutes} />
        </div>
        <Segmented label="Change players every" options={intervalOptions} value={interval} onChange={setIntervalMinutes} />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Keeper</span>
          <select
            value={keeper ?? ""}
            onChange={(e) => setKeeperId(e.target.value)}
            className="min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
          >
            <option value="">Keeper rotates with everyone</option>
            {selectedPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} plays the whole match in goal
              </option>
            ))}
          </select>
        </label>
      </Card>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          Who&apos;s here <span className="font-normal text-muted-foreground">· {selected.size} picked</span>
        </h2>
        <Card className="px-4 py-2">
          <ul className="divide-y divide-border">
            {players.map((p) => (
              <SquadRow
                key={p.id}
                player={p}
                selected={selected.has(p.id)}
                starting={starters.has(p.id)}
                onToggle={() => setSelected((s) => toggle(s, p.id))}
                onToggleStart={() => setStarters((s) => toggle(s, p.id))}
              />
            ))}
          </ul>
        </Card>
      </section>

      {selectedPlayers.length > 0 && <PlanPreview plan={plan} names={names} squad={playerIds} />}

      <div className="sticky bottom-4 z-10">
        <Button block size="lg" disabled={selectedPlayers.length === 0} onClick={() => onStart(config)}>
          <Play className="size-5" aria-hidden="true" />
          Start match day
        </Button>
      </div>
    </div>
  );
}
