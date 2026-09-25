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
import { reportError } from "@/lib/report-error";
import { RetryButton } from "@/components/ui/retry-button";
import { currentHourInTimezone, formatInTimezone, formatTime, formatWeekdayDayMonth } from "@/lib/time";

function greeting() {
  const hour = currentHourInTimezone();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default async function CoachDashboardPage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "Coach";

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, age_group, invite_code")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true);

  if (teamsError) {
    reportError(teamsError, { scope: "coach today page", extra: { query: "teams" } });
  }

  const rawTeams = teamRows ?? [];
  const teamIds = rawTeams.map((t) => t.id);
  const now = new Date().toISOString();
  const weekAgo = new Date(new Date(now).getTime() - 7 * 24 * 3600 * 1000).toISOString();

  // Batch queries instead of O(2n) per-team round-trips
  const [{ data: memberRows, error: memberRowsError }, { data: upcomingRows, error: upcomingRowsError }] = await Promise.all([
    teamIds.length
      ? supabase.from("team_members").select("team_id").in("team_id", teamIds).eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      // A fixture whose kickoff has passed isn't "upcoming" for this badge,
      // even if the coach hasn't logged its result yet.
      ? supabase.from("fixtures").select("team_id").in("team_id", teamIds).eq("status", "upcoming").gte("fixture_date", now)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (memberRowsError) {
    reportError(memberRowsError, { scope: "coach today page", extra: { query: "team_members counts" } });
  }
  if (upcomingRowsError) {
    reportError(upcomingRowsError, { scope: "coach today page", extra: { query: "upcoming fixture counts" } });
  }

  const squadCountMap = new Map<string, number>();
  const upcomingCountMap = new Map<string, number>();
  for (const r of memberRows ?? []) squadCountMap.set(r.team_id, (squadCountMap.get(r.team_id) ?? 0) + 1);
  for (const r of upcomingRows ?? []) upcomingCountMap.set(r.team_id, (upcomingCountMap.get(r.team_id) ?? 0) + 1);

  // `null` (rather than 0) marks "couldn't load" so the team row can say so
  // instead of showing a phantom "0 players" that reads as a real count.
  const allTeams = rawTeams.map((team) => ({
    ...team,
    squadCount: memberRowsError ? null : squadCountMap.get(team.id) ?? 0,
    upcomingCount: upcomingRowsError ? null : upcomingCountMap.get(team.id) ?? 0,
  }));

  const weekAhead = new Date(new Date(now).getTime() + 7 * 24 * 3600 * 1000).toISOString();

  type UpcomingFixtureRow = {
    id: string; opponent: string; fixture_date: string; is_home: boolean; team_id: string;
    teams: { name: string } | { name: string }[] | null;
  };

  const [{ data: upcomingFixtureRows, error: nextFixturesError }, { data: nextSessions, error: nextSessionsError }] = await Promise.all([
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
      : Promise.resolve({ data: [] as UpcomingFixtureRow[], error: null }),
    teamIds.length
      ? supabase
          .from("training_sessions")
          .select("id, title, session_date, location, session_type, team_id, teams(name)")
          .in("team_id", teamIds)
          .gte("session_date", now)
          .order("session_date")
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (nextFixturesError) {
    reportError(nextFixturesError, { scope: "coach today page", extra: { query: "next fixture" } });
  }
  if (nextSessionsError) {
    reportError(nextSessionsError, { scope: "coach today page", extra: { query: "next session" } });
  }
  // Either query failing means "What's Next" can't be trusted — showing
  // partial data anyway could hide a real fixture/session behind an error.
  const nextUpError = Boolean(nextFixturesError || nextSessionsError);

  // Earliest fixture per team, re-sorted by kickoff so the soonest match
  // leads regardless of which team it belongs to.
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
  const [
    { data: unloggedFixtures, error: unloggedFixturesError },
    { data: recentSessions, error: recentSessionsError },
    welfareResult,
  ] = await Promise.all([
    teamIds.length
      ? supabase.from("fixtures").select("id").in("team_id", teamIds).eq("status", "upcoming").lt("fixture_date", now)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from("training_sessions").select("id").in("team_id", teamIds).gte("session_date", weekAgo).lt("session_date", now)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length ? getWelfareAlerts() : Promise.resolve({ alerts: [] }),
  ]);

  if (unloggedFixturesError) {
    reportError(unloggedFixturesError, { scope: "coach today page", extra: { query: "unlogged fixtures" } });
  }
  if (recentSessionsError) {
    reportError(recentSessionsError, { scope: "coach today page", extra: { query: "recent sessions" } });
  }

  const recentSessionIds = (recentSessions ?? []).map((s: { id: string }) => s.id);
  let registersNotTaken = 0;
  let takenRowsError: unknown = null;
  if (recentSessionIds.length) {
    const { data: takenRows, error } = await supabase
      .from("training_attendance")
      .select("session_id")
      .in("session_id", recentSessionIds);
    takenRowsError = error;
    if (takenRowsError) {
      reportError(takenRowsError, { scope: "coach today page", extra: { query: "training attendance taken" } });
    }
    const takenSet = new Set((takenRows ?? []).map((r: { session_id: string }) => r.session_id));
    registersNotTaken = recentSessionIds.filter((id) => !takenSet.has(id)).length;
  }

  const resultsNotLogged = unloggedFixtures?.length ?? 0;
  const welfareError = "error" in welfareResult;
  const welfareAlerts = "alerts" in welfareResult ? welfareResult.alerts.length : 0;
  const hasTodos = resultsNotLogged > 0 || registersNotTaken > 0 || welfareAlerts > 0;
  // Any of these failing means "All caught up" would be a lie — a failed
  // query and a genuinely empty to-do list must not look identical.
  const todoError = Boolean(unloggedFixturesError || recentSessionsError || takenRowsError || welfareError);

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

      {teamsError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Couldn&apos;t load your teams</CardTitle>
            <CardDescription>
              Something went wrong loading your dashboard — this isn&apos;t
              necessarily an empty account. Try reloading; if it keeps
              happening, tell your admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RetryButton />
          </CardContent>
        </Card>
      ) : allTeams.length === 0 ? (
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
          {nextUpError && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle>Couldn&apos;t load what&apos;s next</CardTitle>
                <CardDescription>
                  Something went wrong checking for upcoming fixtures and
                  training — this doesn&apos;t mean there&apos;s nothing
                  scheduled. Try reloading.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RetryButton />
              </CardContent>
            </Card>
          )}
          {!nextUpError && upcomingTeamFixtures.length === 0 && !nextSession && (
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
          {!nextUpError && upcomingTeamFixtures.map((fixture) => {
            const date = new Date(fixture.fixture_date);
            const teamName = multiTeam
              ? (Array.isArray(fixture.teams) ? fixture.teams[0]?.name : (fixture.teams as { name: string } | null)?.name)
              : null;
            return (
              <FixtureTicket
                key={fixture.id}
                href={`/dashboard/coach/fixtures/${fixture.id}`}
                weekday={formatInTimezone(date, { weekday: "short" })}
                day={formatInTimezone(date, { day: "numeric" })}
                month={formatInTimezone(date, { month: "short" })}
                time={formatTime(date)}
                opponent={fixture.opponent}
                isHome={fixture.is_home}
                teamName={teamName}
              />
            );
          })}
          {/* Training always shows alongside fixtures now, not only when no
              team has one — a coach with Sunday's match already ticketed
              above still needs to see Wednesday's session. */}
          {!nextUpError && nextSession && (() => {
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
                      {formatWeekdayDayMonth(date)}
                      {" · "}
                      {formatTime(date)}
                      {nextSession.location && ` · ${nextSession.location}`}
                      {teamName && ` · ${teamName}`}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* ── To-do ─────────────────────────────────────────────── */}
          {todoError ? (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle>Couldn&apos;t check what needs you</CardTitle>
                <CardDescription>
                  Something went wrong loading your to-dos — this isn&apos;t
                  the same as being all caught up. Try reloading.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RetryButton />
              </CardContent>
            </Card>
          ) : hasTodos ? (
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
                  subtitle={
                    team.squadCount === null || team.upcomingCount === null
                      ? "Counts unavailable — try reloading"
                      : `${team.squadCount} players · ${team.upcomingCount} upcoming`
                  }
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
