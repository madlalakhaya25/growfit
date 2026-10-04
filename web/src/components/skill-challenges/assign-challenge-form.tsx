"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assignSkillChallenge } from "@/app/actions/skill-challenges";
import { SKILL_CHALLENGES } from "@/lib/skill-challenges";

const field =
  "h-11 w-full rounded-[10px] border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Set a challenge for the whole team or one player, with a date to try it by. */
export function AssignChallengeForm({
  teamId,
  players,
  defaultDueOn,
  minDueOn,
}: Readonly<{ teamId: string; players: { id: string; name: string }[]; defaultDueOn: string; minDueOn: string }>) {
  const [challengeKey, setChallengeKey] = useState(SKILL_CHALLENGES[0].key);
  const [playerId, setPlayerId] = useState("");
  const [dueOn, setDueOn] = useState(defaultDueOn);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await assignSkillChallenge({ teamId, challengeKey, dueOn, playerId: playerId || null });
      if (res?.error) toast.error(res.error);
      else toast.success(playerId ? "Challenge set for one player." : "Challenge set for the team.");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Set a challenge</h2>
      <div className="space-y-1">
        <label htmlFor="sc-challenge" className="text-sm font-medium">Challenge</label>
        <select id="sc-challenge" value={challengeKey} onChange={(e) => setChallengeKey(e.target.value)} className={field}>
          {SKILL_CHALLENGES.map((c) => (
            <option key={c.key} value={c.key}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="sc-player" className="text-sm font-medium">Who</label>
          <select id="sc-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={field}>
            <option value="">The whole team</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="sc-due" className="text-sm font-medium">Try by</label>
          <input id="sc-due" type="date" min={minDueOn} value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={field} />
        </div>
      </div>
      <Button type="submit" block disabled={pending}>
        {pending ? "Saving..." : "Set challenge"}
      </Button>
    </form>
  );
}
