import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AssignChallengeForm } from "@/components/skill-challenges/assign-challenge-form";
import { TeamChallengePanel } from "@/components/skill-challenges/team-challenge-panel";
import { SKILL_CHALLENGES_NOT_YET, loadAssignments, loadAttempts } from "@/lib/skill-challenges-data";
import { TARGETS_NOTE, getSkillChallenge, skillAgeBand } from "@/lib/skill-challenges";
import { addDays } from "@/lib/week-plan";
import { todayIso } from "@/lib/time";

type MemberRow = { player_id: string; players: { id: string; full_name: string } | { id: string; full_name: string }[] | null };

/** Set ball-skill home challenges for the team and see who has had a go. */
export default async function CoachChallengesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ team?: string }> }>) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, age_group")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");
  if (!allTeams?.length) redirect("/dashboard/coach");
  const team = (await resolveCurrentTeamFromCookies(allTeams, teamParam)) ?? allTeams[0];
  const band = skillAgeBand(team.age_group as string | null);

  const { data: members } = await supabase
    .from("team_members")
    .select("player_id, players ( id, full_name )")
    .eq("team_id", team.id)
    .eq("active", true);
  const roster = ((members ?? []) as MemberRow[])
    .map((m) => (Array.isArray(m.players) ? m.players[0] : m.players))
    .filter((p): p is { id: string; full_name: string } => !!p)
    .map((p) => ({ id: p.id, name: p.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [assignments, attempts] = await Promise.all([
    loadAssignments(supabase, [team.id]),
    loadAttempts(supabase, roster.map((p) => p.id)),
  ]);
  const today = todayIso();
  const nameOf = new Map(roster.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill challenges"
        description={`Home ball-mastery challenges for ${team.name} (${band} targets). Children log their own scores and win medals.`}
      />
      {assignments.available && attempts.available ? (
        <>
          <AssignChallengeForm teamId={team.id} players={roster} defaultDueOn={addDays(today, 7)} minDueOn={today} />
          <p className="text-xs text-muted-foreground">{TARGETS_NOTE}</p>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Set for this team</h2>
            {assignments.rows.length === 0 && (
              <EmptyState icon={Trophy} message="No challenges set yet. Pick one above to get the squad practising at home." />
            )}
            {assignments.rows.map((a) => {
              const challenge = getSkillChallenge(a.challenge_key);
              if (!challenge) return null;
              const targets = a.player_id ? roster.filter((p) => p.id === a.player_id) : roster;
              return (
                <TeamChallengePanel
                  key={a.id}
                  assignmentId={a.id}
                  challenge={challenge}
                  dueOn={a.due_on}
                  band={band}
                  players={targets}
                  forName={a.player_id ? (nameOf.get(a.player_id) ?? "One player") : null}
                  attempts={attempts.rows}
                />
              );
            })}
          </section>
        </>
      ) : (
        <EmptyState icon={Trophy} message={SKILL_CHALLENGES_NOT_YET} />
      )}
    </div>
  );
}
