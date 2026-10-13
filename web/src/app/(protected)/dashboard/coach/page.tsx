import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FixtureTicket } from "@/components/ui/fixture-ticket";
import { ListRow, GroupedSection } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { Suspense } from "react";
import { Users, Calendar, Plus, Dumbbell } from "lucide-react";
import { CreateTeamForm } from "@/components/create-team-form";
import { JoinTeamForm } from "@/components/join-team-form";
import { CopyButton } from "@/components/copy-button";
import { daysFromNow } from "@/lib/utils";
import { isHappeningNow, sessionWindowStart } from "@/lib/session-window";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { reportError } from "@/lib/report-error";
import { RetryButton } from "@/components/ui/retry-button";
import { CardSkeleton, HatCards, NeedsYou, OpenObjectives } from "./today-cards";
import { currentHourInTimezone, formatInTimezone, formatTime, formatWeekdayDayMonth } from "@/lib/time";

function greeting() {
  const hour = currentHourInTimezone();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default async function CoachDashboardPage() {
  const { supabase, user } = await requireUser();
  const [profile, { data: teamRows, error: teamsError }] = await Promise.all([
    getProfile(),
    getCoachedTeamIds(supabase, user.id).then((ids) =>
      supabase.from("teams").select("id, name, age_group, invite_code").in("id", ids).eq("active", true)
    ),
  ]);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "Coach";

  if (teamsError) {
    reportError(teamsError, { scope: "coach today page", extra: { query: "teams" } });
  }

  const rawTeams = teamRows ?? [];
  const teamIds = rawTeams.map((t) => t.id);
  const now = new Date().toISOString();
  const weekAhead = new Date(new Date(now).getTime() + 7 * 24 * 3600 * 1000).toISOString();

  type UpcomingFixtureRow = {
    id: string; opponent: string; fixture_date: string; is_home: boolean; team_id: string;
    teams: { name: string } | { name: string }[] | null;
  };

  // Counts and what's next in one round of parallel queries. The slower
  // to-dos, objectives and hat cards stream in behind Suspense below
  // (today-cards.tsx), so this is all the page waits for.
  const [
    { data: memberRows, error: memberRowsError },
    { data: upcomingRows, error: upcomingRowsError },
    { data: upcomingFixtureRows, error: nextFixturesError },
    { data: nextSessions, error: nextSessionsError },
  ] = await Promise.all([
    teamIds.length
      ? supabase.from("team_members").select("team_id").in("team_id", teamIds).eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      // A fixture whose kickoff has passed isn't "upcoming" for this badge,
      // even if the coach hasn't logged its result yet.
      ? supabase.from("fixtures").select("team_id").in("team_id", teamIds).eq("status", "upcoming").gte("fixture_date", now)
      : Promise.resolve({ data: [], error: null }),
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
          // From the start of the window, not from now: a session that has
          // begun stays on Today while it is on (lib/session-window.ts).
          .gte("session_date", sessionWindowStart(new Date(now).getTime()))
          .order("session_date")
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (memberRowsError) {
    reportError(memberRowsError, { scope: "coach today page", extra: { query: "team_members counts" } });
  }
  if (upcomingRowsError) {
    reportError(upcomingRowsError, { scope: "coach today page", extra: { query: "upcoming fixture counts" } });
  }
  if (nextFixturesError) {
    reportError(nextFixturesError, { scope: "coach today page", extra: { query: "next fixture" } });
  }
  if (nextSessionsError) {
    reportError(nextSessionsError, { scope: "coach today page", extra: { query: "next session" } });
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
  const teamNames = Object.fromEntries(rawTeams.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatWeekdayDayMonth(new Date())}
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
            const onNow = isHappeningNow(nextSession.session_date, new Date(now).getTime());
            const daysLabel = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
            return (
              <Link
                href={`/dashboard/coach/training/${nextSession.id}`}
                className="group block rounded-2xl bg-[#a71817] p-5 text-white shadow-[0_12px_28px_rgb(167_24_23/0.25)] transition-transform duration-200 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-white/90">
                    {onNow ? "Training now" : `Next training · ${daysLabel}`}
                  </p>
                  <span className="grid size-9 place-items-center rounded-full bg-white/15">
                    <Dumbbell className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.01em]">{nextSession.title}</p>
                <p className="mt-1 text-[15px] text-white/90">
                  {formatWeekdayDayMonth(date)}
                  {" · "}
                  {formatTime(date)}
                  {nextSession.location && ` · ${nextSession.location}`}
                  {teamName && ` · ${teamName}`}
                </p>
                <span className="mt-4 flex h-11 items-center justify-center rounded-full bg-white px-5 text-[17px] font-semibold text-[#a71817] transition-colors group-hover:bg-white/90 sm:inline-flex">
                  {onNow ? "Take the register" : "Open the session"}
                </span>
              </Link>
            );
          })()}

          <Suspense fallback={null}>
            <OpenObjectives teamIds={teamIds} teamNames={multiTeam ? teamNames : undefined} />
          </Suspense>

          <Suspense fallback={null}>
            <HatCards userId={user.id} academyId={profile?.academy_id ?? null} />
          </Suspense>

          {/* ── To-do: counts plus a link to the list, not a deep link per
              item (docs/AI_FEATURES_AND_IA.md Part 4). ───────────────── */}
          <Suspense fallback={<CardSkeleton />}>
            <NeedsYou teamIds={teamIds} now={now} />
          </Suspense>

          {/* ── Teams ─────────────────────────────────────────────── */}
          <GroupedSection title="Your teams">
              {allTeams.map((team) => (
                <ListRow
                  key={team.id}
                  leading={<IconTile tone="green"><Users aria-hidden="true" /></IconTile>}
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
          </GroupedSection>

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
