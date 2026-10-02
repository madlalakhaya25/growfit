import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { todayIso } from "@/lib/time";
import { buildTermPlan } from "@/lib/term-plan";
import { loadTermPlanInputs } from "@/lib/term-plan-data";
import { TermPlanView } from "@/components/training/term-plan-view";

export default async function TermPlanPage({ searchParams }: Readonly<{ searchParams: Promise<{ team?: string }> }>) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: allTeams }, { data: profile }] = await Promise.all([
    supabase.from("teams").select("id, name, age_group").in("id", await getCoachedTeamIds(supabase, user.id)).eq("active", true).order("created_at"),
    supabase.from("profiles").select("academy_id").eq("id", user.id).single(),
  ]);
  if (!allTeams?.length || !profile?.academy_id) redirect("/dashboard/coach");
  const team = (await resolveCurrentTeamFromCookies(allTeams, teamParam)) ?? allTeams[0];

  const inputs = await loadTermPlanInputs(supabase, team.id, profile.academy_id as string, todayIso());
  const weeks = inputs.term ? buildTermPlan({ term: inputs.term, ageGroup: team.age_group, fixtures: inputs.fixtures }) : [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/coach/training" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Training
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Term plan: {team.name}</h1>
        {inputs.term && (
          <p className="text-sm text-muted-foreground">
            {inputs.term.name}. Wednesday and Friday sessions spread across the four corners, with lighter weeks built in. A suggestion to change as you like.
          </p>
        )}
      </div>
      {!inputs.available && <p className="text-sm text-muted-foreground">School terms are not switched on yet. Ask your administrator to finish setting them up.</p>}
      {inputs.available && !inputs.term && <p className="text-sm text-muted-foreground">No school terms are set up yet. An administrator can add them under Academy settings.</p>}
      {inputs.term && <TermPlanView teamId={team.id} weeks={weeks} sessionDates={[...inputs.sessionDates]} />}
    </div>
  );
}
