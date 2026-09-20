import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Plus, Dumbbell, ChevronRight } from "lucide-react";
import { CreateTeamForm } from "@/components/create-team-form";
import { JoinTeamForm } from "@/components/join-team-form";
import { CopyButton } from "@/components/copy-button";
import { daysFromNow } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { getWelfareAlerts } from "@/app/actions/welfare";
import { WelfareCheckinsPanel } from "@/components/welfare/welfare-checkins-panel";

const SESSION_TYPE_LABEL: Record<string, string> = {
  general: "General", technical: "Technical", tactical: "Tactical",
  fitness: "Fitness", match_prep: "Match Prep", recovery: "Recovery",
};

export default async function CoachDashboardPage() {
  const { supabase, user } = await requireUser();

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, age_group, invite_code")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true);

  const rawTeams = teamRows ?? [];
  const teamIds = rawTeams.map((t) => t.id);
  const now = new Date().toISOString();

  // Batch queries instead of O(2n) per-team round-trips
  const [{ data: memberRows }, { data: upcomingRows }] = await Promise.all([
    teamIds.length
      ? supabase.from("team_members").select("team_id").in("team_id", teamIds).eq("active", true)
      : Promise.resolve({ data: [] }),
    teamIds.length
      // A fixture whose kickoff has passed isn't "upcoming" for this badge,
      // even if the coach hasn't logged its result yet.
      ? supabase.from("fixtures").select("team_id").in("team_id", teamIds).eq("status", "upcoming").gte("fixture_date", now)
      : Promise.resolve({ data: [] }),
  ]);

  const squadCountMap = new Map<string, number>();
  const upcomingCountMap = new Map<string, number>();
  for (const r of memberRows ?? []) squadCountMap.set(r.team_id, (squadCountMap.get(r.team_id) ?? 0) + 1);
  for (const r of upcomingRows ?? []) upcomingCountMap.set(r.team_id, (upcomingCountMap.get(r.team_id) ?? 0) + 1);

  const allTeams = rawTeams.map((team) => ({
    ...team,
    squadCount: squadCountMap.get(team.id) ?? 0,
    upcomingCount: upcomingCountMap.get(team.id) ?? 0,
  }));

  const [{ data: nextFixtures }, { data: nextSessions }] = await Promise.all([
    teamIds.length
      ? supabase
          .from("fixtures")
          .select("id, opponent, fixture_date, is_home, team_id, teams(name)")
          .in("team_id", teamIds)
          .eq("status", "upcoming")
          .gte("fixture_date", now)
          .order("fixture_date")
          .limit(1)
      : Promise.resolve({ data: null }),
    teamIds.length
      ? supabase
          .from("training_sessions")
          .select("id, title, session_date, location, session_type, team_id, teams(name)")
          .in("team_id", teamIds)
          .gte("session_date", now)
          .order("session_date")
          .limit(1)
      : Promise.resolve({ data: null }),
  ]);

  const nextFixture = nextFixtures?.[0] ?? null;
  const nextSession = nextSessions?.[0] ?? null;
  const multiTeam = allTeams.length > 1;

  const welfareResult = teamIds.length ? await getWelfareAlerts() : { alerts: [] };
  const welfareAlerts = "alerts" in welfareResult ? welfareResult.alerts : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {allTeams.length > 0 && (
          <Button asChild>
            <Link href="#create-team">
              <Plus className="size-4" aria-hidden="true" />
              New team
            </Link>
          </Button>
        )}
      </div>

      {allTeams.length === 0 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Join a team</CardTitle>
              <CardDescription>
                If your admin has already set up the teams, enter the coach code they
                gave you. A team can have more than one coach.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinTeamForm compact />
            </CardContent>
          </Card>

          <Card id="create-team">
            <CardHeader>
              <CardTitle>Or create your own team</CardTitle>
              <CardDescription>Set up a team to start managing your squad, fixtures, and training.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateTeamForm />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">

          <WelfareCheckinsPanel alerts={welfareAlerts} />

          {/* ── What's Next ───────────────────────────────────────── */}
          {!nextFixture && !nextSession && (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-6 space-y-3">
              <p className="text-sm text-muted-foreground">No upcoming fixtures or training sessions yet.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/coach/fixtures/new?team=${allTeams[0].id}`}>
                    <Calendar className="size-3.5" aria-hidden="true" />
                    Schedule fixture
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/coach/training/new?team=${allTeams[0].id}`}>
                    <Dumbbell className="size-3.5" aria-hidden="true" />
                    Plan training
                  </Link>
                </Button>
              </div>
            </div>
          )}
          {(nextFixture || nextSession) && (
            <section className="grid gap-3 sm:grid-cols-2">
              {nextFixture && (() => {
                const days = daysFromNow(nextFixture.fixture_date);
                const date = new Date(nextFixture.fixture_date);
                const teamName = multiTeam
                  ? (Array.isArray(nextFixture.teams)
                    ? nextFixture.teams[0]?.name
                    : (nextFixture.teams as { name: string } | null)?.name)
                  : null;
                const daysLabel = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
                return (
                  <Link href={`/dashboard/coach/fixtures/${nextFixture.id}`}>
                    <div className="group flex h-full items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="size-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Next fixture · {daysLabel}
                        </p>
                        <p className="mt-1 font-semibold leading-snug">
                          {nextFixture.is_home ? "vs" : "@"} {nextFixture.opponent}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                          {teamName && ` · ${teamName}`}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })()}

              {nextSession && (() => {
                const days = daysFromNow(nextSession.session_date);
                const date = new Date(nextSession.session_date);
                const teamName = multiTeam
                  ? (Array.isArray(nextSession.teams)
                    ? nextSession.teams[0]?.name
                    : (nextSession.teams as { name: string } | null)?.name)
                  : null;
                const daysLabel = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
                return (
                  <Link href={`/dashboard/coach/training/${nextSession.id}`}>
                    <div className="group flex h-full items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Dumbbell className="size-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          Next training · {daysLabel}
                        </p>
                        <p className="mt-1 font-semibold leading-snug">{nextSession.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                          {nextSession.location && ` · ${nextSession.location}`}
                          {teamName && ` · ${teamName}`}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })()}
            </section>
          )}

          {/* ── Teams ─────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allTeams.map((team) => (
              <Card key={team.id} className="flex flex-col overflow-hidden">
                <div className="h-1 bg-primary" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{team.name}</CardTitle>
                    {team.age_group && (
                      <Badge variant="brand" className="shrink-0 text-xs">
                        {team.age_group}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium">
                      <Users className="size-3 text-muted-foreground" aria-hidden="true" />
                      {team.squadCount} players
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium">
                      <Calendar className="size-3 text-muted-foreground" aria-hidden="true" />
                      {team.upcomingCount} upcoming
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Player invite code</p>
                    <CopyButton text={team.invite_code} />
                  </div>
                  <div className="mt-auto grid grid-cols-3 gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/coach/squad?team=${team.id}`}>Squad</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/coach/fixtures?team=${team.id}`}>Fixtures</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/coach/training?team=${team.id}`}>Training</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card id="create-team">
            <CardHeader>
              <CardTitle>Add another team</CardTitle>
              <CardDescription>Manage multiple squads from a single account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Join a team with a coach code</p>
                <p className="text-xs text-muted-foreground">
                  For a team your admin has already set up. A team can have more than
                  one coach, so this works alongside whoever is already on it.
                </p>
                <JoinTeamForm compact />
              </div>

              <div className="border-t border-border pt-5 space-y-2">
                <p className="text-sm font-medium">Or create a new team</p>
                <CreateTeamForm />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
