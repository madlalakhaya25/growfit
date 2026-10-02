import { Home } from "lucide-react";
import type { HomeChallenge } from "@/lib/home-challenge";

/** This week's drill from the approved plan. Read-only; calls no model. */
export function HomeChallengeCard({
  challenge,
  audience,
  childName,
}: Readonly<{ challenge: HomeChallenge; audience: "player" | "parent"; childName?: string }>) {
  const { action } = challenge;
  const heading = audience === "parent" ? `This week's home challenge for ${childName ?? "your child"}` : "This week's home challenge";
  return (
    <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Home className="size-3.5" aria-hidden="true" />
        {heading}
      </p>
      <p className="text-sm font-semibold">{action.what}</p>
      {action.how && <p className="text-sm text-muted-foreground">{action.how}</p>}
      <p className="text-xs text-muted-foreground">
        {action.timesPerWeek}x this week{action.measure ? ` · ${action.measure}` : ""}
      </p>
    </div>
  );
}
