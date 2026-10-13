import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewSessionForm } from "./new-session-form";
import { recentTurnout } from "@/lib/recent-turnout";
import { cleanFocus } from "@/lib/squad-focus";
import { z } from "zod";
import { requireCoachTeams } from "@/lib/auth";

export default async function NewTrainingSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; focus?: string; objective?: string }>;
}) {
  const { team: teamParam, focus: focusParam, objective: objectiveParam } = await searchParams;
  const { supabase, allTeams } = await requireCoachTeams();

  const team = allTeams.find((t) => t.id === teamParam) ?? allTeams[0];

  const suggestedSquadSizes: Record<string, number> = {};
  await Promise.all(
    allTeams.map(async (t) => {
      const typical = await recentTurnout(supabase, t.id);
      if (typical) suggestedSquadSizes[t.id] = typical;
    })
  );

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/coach/training?team=${team.id}`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Training
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold">New training session</h1>
        {allTeams.length > 1 && (
          <p className="text-sm text-muted-foreground mt-1">
            Team: <span className="font-medium">{team.name}</span>
          </p>
        )}
      </div>
      <NewSessionForm
        teamId={team.id}
        teams={allTeams}
        backHref={`/dashboard/coach/training?team=${team.id}`}
        suggestedSquadSizes={suggestedSquadSizes}
        defaultFocus={cleanFocus(focusParam)}
        objectiveId={z.string().uuid().safeParse(objectiveParam).data}
      />
    </div>
  );
}
