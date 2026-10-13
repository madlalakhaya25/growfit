import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { loadPlanQueue } from "@/lib/plan-queue-data";
import { PlanQueue } from "@/components/development/plan-queue";
import { requireCoachTeams } from "@/lib/auth";

export default async function SquadPlansPage({ searchParams }: Readonly<{ searchParams: Promise<{ team?: string }> }>) {
  const { team: teamParam } = await searchParams;
  const { supabase, allTeams } = await requireCoachTeams();

  const team = (await resolveCurrentTeamFromCookies(allTeams, teamParam)) ?? allTeams[0];
  const snapshot = await loadPlanQueue(supabase, team.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/coach/squad" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Squad
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Development plans: {team.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft plans for the whole squad, read and edit each one, then approve. Nothing reaches a player or parent until you approve it.
        </p>
      </div>
      {snapshot.available ? (
        <PlanQueue players={snapshot.players} />
      ) : (
        <p className="text-sm text-muted-foreground">Development plans are not switched on yet. Ask your administrator to finish setting them up.</p>
      )}
    </div>
  );
}
