import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { RetryButton } from "@/components/ui/retry-button";
import { ThisWeekObjectives } from "@/components/this-week-objectives";
import { ClipboardList, Dumbbell, HeartPulse, CheckCircle2, ChevronRight, Cake, Flame, type LucideIcon } from "lucide-react";
import { getWelfareAlerts } from "@/app/actions/welfare";
import { reportError } from "@/lib/report-error";
import { upcomingBirthdays } from "@/lib/today-moments";
import { attendanceStreak, STREAK_WORTH_SAYING } from "@/lib/squad-status";
import { attendanceWindowStart, isAttendanceStatus, type AttendanceStatus } from "@/lib/attendance";
import { loadOpenObjectives } from "@/lib/objectives-data";
import { coachCardsFor } from "@/lib/staff-hats";
import { loadOwnHats } from "@/lib/staff-hats-data";
import { loadDirectorCards } from "@/lib/director-data";
import { DirectorCardList } from "../admin/director-cards";

/**
 * The slower parts of Coach Today, each streamed in behind its own Suspense
 * boundary so the next match and session show at once. They used to load one
 * after another before anything rendered: about eight round trips in a row.
 */

export function CardSkeleton({ rows = 2 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
    </div>
  );
}

/**
 * "Needs you": results to log, registers not taken in the past week, and
 * welfare check-ins. Bounded windows (results: unbounded backwards, since any
 * unlogged past fixture is worth flagging; registers: trailing 7 days, since a
 * register from a month ago is history, not a to-do) keep the queries cheap.
 */
export async function NeedsYou({ teamIds, now }: Readonly<{ teamIds: string[]; now: string }>) {
  const supabase = await createClient();
  const weekAgo = new Date(Date.parse(now) - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: unloggedFixtures, error: unloggedFixturesError },
    recent,
    welfareResult,
  ] = await Promise.all([
    supabase.from("fixtures").select("id").in("team_id", teamIds).eq("status", "upcoming").lt("fixture_date", now),
    // The register check depends only on the sessions, so it chains here
    // rather than waiting for the other two.
    supabase.from("training_sessions").select("id").in("team_id", teamIds).gte("session_date", weekAgo).lt("session_date", now)
      .then(async ({ data, error }) => {
        const ids = ((data ?? []) as { id: string }[]).map((s) => s.id);
        if (error || ids.length === 0) return { notTaken: 0, sessionsError: error, takenError: null };
        const { data: taken, error: takenError } = await supabase
          .from("training_attendance").select("session_id").in("session_id", ids);
        const takenSet = new Set(((taken ?? []) as { session_id: string }[]).map((r) => r.session_id));
        return { notTaken: ids.filter((id) => !takenSet.has(id)).length, sessionsError: null, takenError };
      }),
    getWelfareAlerts(),
  ]);

  if (unloggedFixturesError) reportError(unloggedFixturesError, { scope: "coach today page", extra: { query: "unlogged fixtures" } });
  if (recent.sessionsError) reportError(recent.sessionsError, { scope: "coach today page", extra: { query: "recent sessions" } });
  if (recent.takenError) reportError(recent.takenError, { scope: "coach today page", extra: { query: "training attendance taken" } });

  const resultsNotLogged = unloggedFixtures?.length ?? 0;
  const registersNotTaken = recent.notTaken;
  const welfareError = "error" in welfareResult;
  const alerts = "alerts" in welfareResult ? welfareResult.alerts : [];
  const welfareAlerts = alerts.length;
  // Any of these failing means "All caught up" would be a lie — a failed
  // query and a genuinely empty to-do list must not look identical.
  if (unloggedFixturesError || recent.sessionsError || recent.takenError || welfareError) {
    return (
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
    );
  }

  if (resultsNotLogged === 0 && registersNotTaken === 0 && welfareAlerts === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        All caught up — nothing needs you right now.
      </p>
    );
  }

  const count = (resultsNotLogged > 0 ? 1 : 0) + (registersNotTaken > 0 ? 1 : 0) + (welfareAlerts > 0 ? 1 : 0);
  const missed = alerts[0];
  return (
    <section aria-labelledby="needs-you" className="space-y-2">
      <h2 id="needs-you" className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Needs you · {count}
      </h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
        {welfareAlerts > 0 && (
          <NeedRow
            Icon={HeartPulse}
            href="/dashboard/coach/welfare"
            title={
              welfareAlerts === 1
                ? `We've missed ${missed.fullName.trim().split(/\s+/)[0]} lately`
                : `We've missed ${welfareAlerts} players lately`
            }
            subtitle={
              welfareAlerts === 1
                ? `${Math.round(missed.attendancePct)}% this term · a quick check-in?`
                : "Below 75% this term · a quick check-in?"
            }
          />
        )}
        {resultsNotLogged > 0 && (
          <NeedRow
            Icon={ClipboardList}
            href="/dashboard/coach/fixtures"
            title={`${resultsNotLogged} result${resultsNotLogged === 1 ? "" : "s"} still to log`}
            subtitle="Families are waiting to hear how it went"
          />
        )}
        {registersNotTaken > 0 && (
          <NeedRow
            Icon={Dumbbell}
            href="/dashboard/coach/training"
            title={`${registersNotTaken} register${registersNotTaken === 1 ? "" : "s"} not taken`}
            subtitle="From the past week · it keeps attendance fair"
          />
        )}
      </ul>
    </section>
  );
}

function NeedRow({ Icon, href, title, subtitle }: Readonly<{ Icon: LucideIcon; href: string; title: string; subtitle: string }>) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-3.5 py-3 transition-colors hover:bg-hover">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-clay text-clay-foreground">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold leading-snug">{title}</span>
          <span className="text-[13px] text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * "This week": birthdays coming up and the longest run of sessions in a row
 * per team, as sun-coloured cards. Good news only, first names only, and
 * nothing at all when there's nothing to say. A failed query hides the
 * section rather than showing an error, since nothing here is a task.
 */
export async function ThisWeekMoments({
  teams,
  multiTeam,
  now,
}: Readonly<{ teams: { id: string; name: string; age_group: string | null }[]; multiTeam: boolean; now: string }>) {
  if (teams.length === 0) return null;
  const supabase = await createClient();
  const teamIds = teams.map((t) => t.id);
  const label = (teamId: string) => {
    const t = teams.find((x) => x.id === teamId);
    return t ? t.age_group || t.name : "";
  };

  const [{ data: members }, { data: sessions }] = await Promise.all([
    supabase.from("team_members").select("team_id, players(id, full_name, date_of_birth)").in("team_id", teamIds).eq("active", true),
    supabase
      .from("training_sessions")
      .select("id, team_id")
      .in("team_id", teamIds)
      .gte("session_date", attendanceWindowStart())
      .lte("session_date", now)
      .order("session_date", { ascending: false }),
  ]);

  type P = { id: string; full_name: string; date_of_birth: string | null };
  const roster = ((members ?? []) as { team_id: string; players: P | P[] | null }[])
    .map((m) => ({ teamId: m.team_id, player: Array.isArray(m.players) ? m.players[0] : m.players }))
    .filter((m): m is { teamId: string; player: P } => Boolean(m.player));
  const first = (name: string) => name.trim().split(/\s+/)[0];

  const birthdays = upcomingBirthdays(
    roster.map((m) => ({ firstName: first(m.player.full_name), dateOfBirth: m.player.date_of_birth, teamLabel: label(m.teamId) })),
    new Date(now),
  );

  // Best current streak per team.
  const sessionRows = (sessions ?? []) as { id: string; team_id: string }[];
  const streaks: { name: string; teamLabel: string; run: number }[] = [];
  if (sessionRows.length) {
    const { data: att } = await supabase
      .from("training_attendance")
      .select("session_id, player_id, status")
      .in("session_id", sessionRows.map((s) => s.id));
    const marks = new Map<string, Map<string, AttendanceStatus>>();
    for (const r of (att ?? []) as { session_id: string; player_id: string; status: string }[]) {
      if (!isAttendanceStatus(r.status)) continue;
      const reg = marks.get(r.session_id) ?? new Map<string, AttendanceStatus>();
      reg.set(r.player_id, r.status);
      marks.set(r.session_id, reg);
    }
    for (const teamId of teamIds) {
      const order = sessionRows.filter((s) => s.team_id === teamId).map((s) => s.id);
      let best: { name: string; run: number } | null = null;
      for (const m of roster.filter((r) => r.teamId === teamId)) {
        const run = attendanceStreak(m.player.id, order, marks);
        if (run >= STREAK_WORTH_SAYING && (!best || run > best.run)) best = { name: first(m.player.full_name), run };
      }
      if (best) streaks.push({ ...best, teamLabel: label(teamId) });
    }
  }

  const cards = [
    ...birthdays.map((b) => ({
      key: `b-${b.firstName}-${b.teamLabel}`,
      Icon: Cake,
      title: `${b.firstName} turns ${b.turns} ${b.when}`,
      sub: `${multiTeam ? `${b.teamLabel} · ` : ""}say it at training`,
    })),
    ...streaks.map((s) => ({
      key: `s-${s.teamLabel}`,
      Icon: Flame,
      title: `${s.name}: ${s.run} sessions in a row`,
      sub: `${multiTeam ? `${s.teamLabel} · ` : ""}longest run right now`,
    })),
  ].slice(0, 4);
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="this-week" className="space-y-2">
      <h2 id="this-week" className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">This week</h2>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(({ key, Icon, title, sub }) => (
          <li key={key} className="flex flex-col gap-1 rounded-2xl bg-sun p-3 text-sun-foreground">
            <Icon className="size-5" aria-hidden="true" />
            <span className="text-sm font-bold leading-snug text-foreground">{title}</span>
            <span className="text-xs">{sub}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function OpenObjectives({ teamIds, teamNames }: Readonly<{ teamIds: string[]; teamNames?: Record<string, string> }>) {
  const supabase = await createClient();
  const objectives = await loadOpenObjectives(supabase, teamIds);
  return <ThisWeekObjectives objectives={objectives} teamNames={teamNames} />;
}

/**
 * A coach with a hat (director, technical director) also sees that hat's
 * academy-wide cards. No hats, or the table missing, adds nothing.
 */
export async function HatCards({ userId, academyId }: Readonly<{ userId: string; academyId: string | null }>) {
  const supabase = await createClient();
  const cards = coachCardsFor(await loadOwnHats(supabase, userId));
  if (cards.length === 0) return null;
  let teams: { id: string; name: string }[] = [];
  if (academyId) {
    const { data } = await supabase.from("teams").select("id, name").eq("academy_id", academyId).eq("active", true);
    teams = (data ?? []) as { id: string; name: string }[];
  }
  const cardData = await loadDirectorCards(supabase, teams, cards);
  return <DirectorCardList cards={cards} data={cardData} coverageHref={null} />;
}
