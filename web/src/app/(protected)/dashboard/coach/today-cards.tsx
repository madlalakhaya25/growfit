import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ListRow, GroupedSection } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { RetryButton } from "@/components/ui/retry-button";
import { ThisWeekObjectives } from "@/components/this-week-objectives";
import { ClipboardList, Dumbbell, HeartPulse, CheckCircle2 } from "lucide-react";
import { getWelfareAlerts } from "@/app/actions/welfare";
import { reportError } from "@/lib/report-error";
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
  const welfareAlerts = "alerts" in welfareResult ? welfareResult.alerts.length : 0;
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

  return (
    <GroupedSection title="Needs you">
      {resultsNotLogged > 0 && (
        <ListRow
          leading={<IconTile tone="blue"><ClipboardList aria-hidden="true" /></IconTile>}
          title={`${resultsNotLogged} result${resultsNotLogged === 1 ? "" : "s"} still to log`}
          subtitle="Kickoff has passed"
          href="/dashboard/coach/fixtures"
        />
      )}
      {registersNotTaken > 0 && (
        <ListRow
          leading={<IconTile tone="orange"><Dumbbell aria-hidden="true" /></IconTile>}
          title={`${registersNotTaken} register${registersNotTaken === 1 ? "" : "s"} not taken`}
          subtitle="From the past week"
          href="/dashboard/coach/training"
        />
      )}
      {welfareAlerts > 0 && (
        <ListRow
          leading={<IconTile tone="red"><HeartPulse aria-hidden="true" /></IconTile>}
          title={`${welfareAlerts} welfare check-in${welfareAlerts === 1 ? "" : "s"} needed`}
          subtitle="Below the 75% attendance threshold"
          href="/dashboard/coach/welfare"
        />
      )}
    </GroupedSection>
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
