import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { loadSquadReview } from "@/lib/term-review-data";
import { todayIso } from "@/lib/time";
import { loadCoachNotes } from "@/lib/coach-notes";
import { ObjectiveHistory } from "@/components/objective-history";
import { loadClosedObjectives } from "@/lib/objectives-data";
import { SquadReview } from "@/components/development/squad-review";

export default async function SquadReviewPage({ searchParams }: Readonly<{ searchParams: Promise<{ team?: string }> }>) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: allTeams }, { data: profile }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, age_group")
      .in("id", await getCoachedTeamIds(supabase, user.id))
      .eq("active", true)
      .order("created_at"),
    supabase.from("profiles").select("academy_id").eq("id", user.id).single(),
  ]);
  if (!allTeams?.length || !profile?.academy_id) redirect("/dashboard/coach");

  const team = (await resolveCurrentTeamFromCookies(allTeams, teamParam)) ?? allTeams[0];
  const snapshot = await loadSquadReview(supabase, team.id, profile.academy_id as string, todayIso());

  const objectiveHistory = await loadClosedObjectives(supabase, team.id);

  const notes = await loadCoachNotes(supabase, user.id, "player", snapshot.players.map((p) => p.id));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/coach/squad" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Squad
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Term review: {team.name}</h1>
      </div>

      <ObjectiveHistory items={objectiveHistory} />

      {!snapshot.available && (
        <p className="text-sm text-muted-foreground">Term review is not switched on yet. Ask your administrator to finish setting it up.</p>
      )}
      {snapshot.available && !snapshot.term && (
        <p className="text-sm text-muted-foreground">
          No school terms are set up yet. An administrator can add them under Academy settings.
        </p>
      )}
      {snapshot.term && (
        <SquadReview
          termId={snapshot.term.id}
          termName={snapshot.term.name}
          lastTermName={snapshot.previous?.name ?? null}
          ageGroup={team.age_group}
          players={snapshot.players}
          notes={notes.bySubject}
          notesAvailable={notes.available}
        />
      )}
    </div>
  );
}
