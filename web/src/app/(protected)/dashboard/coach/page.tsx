import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FixtureTicket } from "@/components/ui/fixture-ticket";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { Users, Calendar, Plus, Dumbbell, ClipboardList, HeartPulse, CheckCircle2 } from "lucide-react";
import { CreateTeamForm } from "@/components/create-team-form";
import { JoinTeamForm } from "@/components/join-team-form";
import { CopyButton } from "@/components/copy-button";
import { daysFromNow } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { getWelfareAlerts } from "@/app/actions/welfare";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default async function CoachDashboardPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "Coach";

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, age_group, invite_code")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true);

  const rawTeams = teamRows ?? [];
  const teamIds = rawTeams.map((t) => t.id);
  const now = new Date().toISOString();
  const weekAgo = new Date(new Date(now).getTime() - 7 * 24 * 3600 * 1000).toISOString();

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

  const weekAhead = new Date(new Date(now).getTime() + 7 * 24 * 3600 * 1000).toISOString();

  type UpcomingFixtureRow = {
    id: string; opponent: string; fixture_date: string; is_home: boolean; team_id: string;
    teams: { name: string } | { name: string }[] | null;
  };

  const [{ data: upcomingFixtureRows }, { data: nextSessions }] = await Promise.all([
    teamIds.length
      // Every team's own earliest fixture, not just one across the whole
      // coach account — a coach running U11/U13/U15 has a Sunday for each.
      ? supabase
          .from("fixtures")
          .select("id, opponent, fixture_date, is_home, team_id, teams(name)")
          .in("team_id", teamIds)
          .eq("status", "upcoming")
          .gte("fixture_date", now)
          .lte("fixture_date", weekAhead)
          .order("fixture_date")
      : Promise.resolve({ data: [] as UpcomingFixtureRow[] }),
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

  // Earliest fixture per team, in team order lost — re-sorted by kickoff
  // below so the soonest match leads regardless of which team it belongs to.
  const nextFixtureByTeam = new Map<string, UpcomingFixtureRow>();
  for (const f of (upcomingFixtureRows ?? []) as UpcomingFixtureRow[]) {
    if (!nextFixtureByTeam.has(f.team_id)) nextFixtureByTeam.set(f.team_id, f);
  }
  const upcomingTeamFixtures = Array.from(nextFixtureByTeam.values()).sort(
    (a, b) => new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime()
  );

  const nextSession = nextSessions?.[0] ?? null;
  const multiTeam = allTeams.length > 1;

  // ── To-do: what actually needs the coach's attention today ─────────
  // Deliberately scoped to counts + a link to the relevant list, not a
  // deep link per item -- see docs/AI_FEATURES_AND_IA.md Part 4's Today
  // redesign. Bounded windows (results: unbounded backwards, since any
  // unlogged past fixture is worth flagging regardless of age; registers:
  // trailing 7 days, since a register from a month ago is history, not a
  // to-do) keep both queries cheap and the counts meaningful.
  const [{ data: unloggedFixtures }, { data: recentSessions }, welfareResult] = await Promise.all([
    teamIds.length
      ? supabase.from("fixtures").select("id").in("team_id", teamIds).eq("status", "upcoming").lt("fixture_date", now)
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? supabase.from("training_sessions").select("id").in("team_id", teamIds).gte("session_date", weekAgo).lt("session_date", now)
      : Promise.resolve({ data: [] }),
    teamIds.length ? getWelfareAlerts() : Promise.resolve({ alerts: [] }),
  ]);

  const recentSessionIds = (recentSessions ?? []).map((s: { id: string }) => s.id);
  let registersNotTaken = 0;
  if (recentSessionIds.length) {
    const { data: takenRows } = await supabase
      .from("training_attendance")
      .select("session_id")
      .in("session_id", recentSessionIds);
    const takenSet = new Set((takenRows ?? []).map((r: { session_id: string }) => r.session_id));
    registersNotTaken = recentSessionIds.filter((id) => !takenSet.has(id)).length;
  }

  const resultsNotLogged = unloggedFixtures?.length ?? 0;
  const welfareAlerts = "alerts" in welfareResult ? welfareResult.alerts.length : 0;
  const hasTodos = resultsNotLogged > 0 || registersNotTaken > 0 || welfareAlerts > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        action={
          allTeams.length > 0 && (
            <Button asChild size="sm" variant="outline">
              <Link href="#create-team">
                <Plus className="size-4" aria-hidden="true" />
                New team
              </Link>
            </Button>
          )
        }
      />

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
          {/* ── What's Next ───────────────────────────────────────── */}
          {upcomingTeamFixtures.length === 0 && !nextSession && (
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
          {upcomingTeamFixtures.map((fixture) => {
            const date = new Date(fixture.fixture_date);
            const teamName = multiTeam
              ? (Array.isArray(fixture.teams) ? fixture.teams[0]?.name : (fixture.teams as { name: string } | null)?.name)
              : null;
            return (
              <FixtureTicket
                key={fixture.id}
                href={`/dashboard/coach/fixtures/${fixture.id}`}
                weekday={date.toLocaleDateString("en-ZA", { weekday: "short" })}
                day={date.toLocaleDateString("en-ZA", { day: "numeric" })}
                month={date.toLocaleDateString("en-ZA", { month: "short" })}
                time={date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                opponent={fixture.opponent}
                isHome={fixture.is_home}
                teamName={teamName}
              />
            );
          })}
          {/* Training always shows alongside fixtures now, not only when no
              team has one — a coach with Sunday's match already ticketed
              above still needs to see Wednesday's session. */}
          {nextSession && (() => {
            const days = daysFromNow(nextSession.session_date);
            const date = new Date(nextSession.session_date);
            const teamName = multiTeam
              ? (Array.isArray(nextSession.teams) ? nextSession.teams[0]?.name : (nextSession.teams as { name: string } | null)?.name)
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
                </div>
              </Link>
            );
          })()}

          {/* ── To-do ─────────────────────────────────────────────── */}
          {hasTodos ? (
            <Card>
              <ListRowGroup className="px-4">
                {resultsNotLogged > 0 && (
                  <ListRow
                    leading={<ClipboardList className="size-5 text-primary" aria-hidden="true" />}
                    title={`${resultsNotLogged} result${resultsNotLogged === 1 ? "" : "s"} still to log`}
                    subtitle="Kickoff has passed"
                    href="/dashboard/coach/fixtures"
                  />
                )}
                {registersNotTaken > 0 && (
                  <ListRow
                    leading={<Dumbbell className="size-5 text-primary" aria-hidden="true" />}
                    title={`${registersNotTaken} register${registersNotTaken === 1 ? "" : "s"} not taken`}
                    subtitle="From the past week"
                    href="/dashboard/coach/training"
                  />
                )}
                {welfareAlerts > 0 && (
                  <ListRow
                    leading={<HeartPulse className="size-5 text-primary" aria-hidden="true" />}
                    title={`${welfareAlerts} welfare check-in${welfareAlerts === 1 ? "" : "s"} needed`}
                    subtitle="Below the 75% attendance threshold"
                    href="/dashboard/coach/welfare"
                  />
                )}
              </ListRowGroup>
            </Card>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              All caught up — nothing needs you right now.
            </p>
          )}

          {/* ── Teams ─────────────────────────────────────────────── */}
          <Card>
            <ListRowGroup className="px-4">
              {allTeams.map((team) => (
                <ListRow
                  key={team.id}
                  leading={<Users className="size-5 text-primary" aria-hidden="true" />}
                  title={team.name}
                  subtitle={`${team.squadCount} players · ${team.upcomingCount} upcoming`}
                  trailing={
                    team.age_group ? <Badge variant="brand" className="text-xs">{team.age_group}</Badge> : undefined
                  }
                  href={`/dashboard/coach/squad?team=${team.id}`}
                />
              ))}
            </ListRowGroup>
          </Card>

          {allTeams.map((team) => (
            <details key={team.id} className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">{team.name} invite code</summary>
              <div className="mt-2">
                <CopyButton text={team.invite_code} />
              </div>
            </details>
          ))}

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
