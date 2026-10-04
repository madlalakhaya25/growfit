"use client";

import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logSkillChallengeAttempt } from "@/app/actions/skill-challenges";
import { MAX_COUNT, MAX_SECONDS, type ChallengeUnit } from "@/lib/skill-challenges";

function clamp(n: number, unit: ChallengeUnit): number {
  const min = unit === "seconds" ? 1 : 0;
  const max = unit === "seconds" ? MAX_SECONDS : MAX_COUNT;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Big minus / number / plus, then Save. Built for a thumb on a phone in the garden. */
export function ScoreLogger({
  challengeKey,
  challengeName,
  unit,
  start,
  childId,
}: Readonly<{ challengeKey: string; challengeName: string; unit: ChallengeUnit; start: number; childId?: string }>) {
  const [text, setText] = useState(String(start));
  const [pending, startTransition] = useTransition();
  const value = Number.parseInt(text, 10);
  const valid = Number.isFinite(value) && clamp(value, unit) === value;
  const label = unit === "seconds" ? "Your time in seconds" : "Your score";

  function step(by: number) {
    setText(String(clamp((Number.isFinite(value) ? value : start) + by, unit)));
  }

  function save() {
    if (!valid) return;
    startTransition(async () => {
      const res = await logSkillChallengeAttempt(challengeKey, value, childId);
      if (res?.error) toast.error(res.error);
      else toast.success("Score saved. Keep going!");
    });
  }

  const inputId = `score-${challengeKey}`;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`One less for ${challengeName}`}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <Minus className="size-6" aria-hidden="true" />
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={unit === "seconds" ? 1 : 0}
          max={unit === "seconds" ? MAX_SECONDS : MAX_COUNT}
          step={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-14 min-w-0 flex-1 rounded-[10px] border border-input bg-card text-center font-display text-3xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`One more for ${challengeName}`}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95"
        >
          <Plus className="size-6" aria-hidden="true" />
        </button>
      </div>
      <Button type="button" block size="lg" onClick={save} disabled={!valid || pending}>
        {pending ? "Saving..." : "Save score"}
      </Button>
    </div>
  );
}
