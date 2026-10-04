"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { saveMatchMinutes } from "@/app/actions/match-minutes";
import type { RotationPlan } from "@/lib/playing-time";
import { finalMinutes, type LiveState } from "@/lib/playing-time-live";

interface FinishPanelProps {
  fixtureId: string;
  state: LiveState;
  names: Map<string, string>;
  plan: RotationPlan;
  onClear: () => void;
}

/** Full time: everyone's actual minutes, saved to the fixture in one tap. */
export function FinishPanel({ fixtureId, state, names, plan, onClear }: Readonly<FinishPanelProps>) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const { confirm, dialog } = useConfirm();
  // The clock is stopped, so these no longer change.
  const minutes = finalMinutes(state, 0);

  const save = () => {
    startTransition(async () => {
      const res = await saveMatchMinutes(fixtureId, minutes);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSaved(true);
      toast.success("Minutes saved.");
    });
  };

  const discard = async () => {
    const ok = await confirm({
      title: "Discard these minutes?",
      body: "They have not been saved. This clears the match from this phone.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (ok) onClear();
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <p className="text-lg font-bold">Full time</p>
        <ul className="divide-y divide-border">
          {minutes.map((m) => (
            <li key={m.playerId} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
              <span className="truncate font-medium">{names.get(m.playerId) ?? "Player"}</span>
              <span className="shrink-0 tabular-nums">
                {m.minutes}&apos;
                <span className="text-muted-foreground"> / planned {plan.minutes[m.playerId] ?? 0}&apos;</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {saved ? (
        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            Saved to this fixture
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="flex-1">
              <Link href={`/dashboard/coach/fixtures/${fixtureId}`}>Back to the fixture</Link>
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClear}>
              Clear from this phone
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <Button block size="lg" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save minutes"}
          </Button>
          <Button block variant="ghost" disabled={pending} onClick={discard}>
            Discard without saving
          </Button>
        </div>
      )}
      {dialog}
    </div>
  );
}
