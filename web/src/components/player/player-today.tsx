import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BookOpenCheck, Dumbbell, Medal, Target, Trophy as TrophyIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GroupedSection, ListRow } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { listMyHomework } from "@/app/actions/homework";
import { loadChallengeBoard, loadPlayerTeams } from "@/lib/skill-challenges-data";
import { TROPHY_LABELS } from "@/lib/skill-challenges";
import { challengeToBeat, homeworkDue, latestMedal } from "@/lib/player-today";
import { nextEventFor, type TodayEvent } from "@/lib/parent-today";
import { formatTime, formatWeekdayDayMonth, todayIso } from "@/lib/time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

async function loadNextEvent(supabase: Client, teamIds: string[], now: Date): Promise<TodayEvent | null | "error"> {
  if (teamIds.length === 0) return null;
  const nowIso = now.toISOString();
  const [fixtures, sessions] = await Promise.all([
    supabase.from("fixtures").select("team_id, opponent, venue, fixture_date").in("team_id", teamIds).eq("status", "upcoming").gte("fixture_date", nowIso).order("fixture_date").limit(20),
    supabase.from("training_sessions").select("team_id, title, location, session_date").in("team_id", teamIds).gte("session_date", nowIso).order("session_date").limit(20),
  ]);
  if (fixtures.error || sessions.error) return "error";
  const events: TodayEvent[] = [
    ...((fixtures.data ?? []) as { team_id: string; opponent: string; venue: string | null; fixture_date: string }[]).map((f) => ({
      kind: "match" as const, teamId: f.team_id, title: `vs ${f.opponent}`, at: f.fixture_date, place: f.venue,
    })),
    ...((sessions.data ?? []) as { team_id: string; title: string; location: string | null; session_date: string }[]).map((s) => ({
      kind: "training" as const, teamId: s.team_id, title: s.title, at: s.session_date, place: s.location,
    })),
  ];
  return nextEventFor(events, new Set(teamIds), now);
}

/**
 * The player's own Today: what is next, what is due, a challenge to beat and the
 * latest medal. Only their own results: nothing here compares them with a
 * teammate.
 */
export async function PlayerToday({ supabase, playerId }: Readonly<{ supabase: Client; playerId: string }>) {
  const now = new Date();
  const teams = await loadPlayerTeams(supabase, playerId);
  const [next, homework, board] = await Promise.all([
    loadNextEvent(supabase, teams.map((t) => t.id), now),
    listMyHomework(),
    loadChallengeBoard(supabase, playerId, todayIso(now)),
  ]);

  const due = homeworkDue(homework.items);
  const beat = challengeToBeat(board.assigned, board.band);
  const medal = latestMedal(board.cabinet);

  return (
    <div className="space-y-6">
      {next === "error" && (
        <Card className="border-destructive/50 p-4 text-sm">
          Couldn&apos;t load what&apos;s next. That doesn&apos;t mean nothing is on. Try reloading.
        </Card>
      )}
      {next && next !== "error" && (
        <div className="rounded-2xl bg-[#a71817] p-5 text-white shadow-[0_12px_28px_rgb(167_24_23/0.25)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-white/90">{next.kind === "match" ? "Next match" : "Next training"}</p>
            <span className="grid size-9 place-items-center rounded-full bg-white/15">
              {next.kind === "match" ? <TrophyIcon className="size-4" aria-hidden="true" /> : <Dumbbell className="size-4" aria-hidden="true" />}
            </span>
          </div>
          <p className="mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.01em]">{next.title}</p>
          <p className="mt-1 text-[15px] text-white/90">
            {formatWeekdayDayMonth(new Date(next.at))} · {formatTime(new Date(next.at))}
            {next.place && ` · ${next.place}`}
          </p>
        </div>
      )}
      {next === null && (
        <Card className="p-4 text-sm text-muted-foreground">Nothing coming up yet. Your next match or training will show here.</Card>
      )}

      {(due || beat) && (
        <GroupedSection title="Needs you">
          {due && (
            <ListRow
              href={`/dashboard/player/homework/${due.id}`}
              leading={<IconTile tone="blue"><BookOpenCheck aria-hidden="true" /></IconTile>}
              title={due.title}
              subtitle={`Homework, due ${formatWeekdayDayMonth(due.dueDate)}`}
            />
          )}
          {beat && (
            <ListRow
              href="/dashboard/player/challenges"
              leading={<IconTile tone="orange"><Target aria-hidden="true" /></IconTile>}
              title={beat.name}
              subtitle={
                beat.next
                  ? `Beat ${beat.next.target} for ${TROPHY_LABELS[beat.next.trophy]}${beat.best === null ? "" : ` (your best: ${beat.best})`}`
                  : `Gold won, best ${beat.best}`
              }
            />
          )}
        </GroupedSection>
      )}

      {medal?.trophy && (
        <GroupedSection title="Latest medal">
          <ListRow
            href="/dashboard/player/challenges"
            leading={<IconTile tone="green"><Medal aria-hidden="true" /></IconTile>}
            title={`${TROPHY_LABELS[medal.trophy]}: ${medal.challenge.name}`}
            subtitle={board.streak > 0 ? `${board.streak} ${board.streak === 1 ? "week" : "weeks"} in a row` : undefined}
          />
        </GroupedSection>
      )}
    </div>
  );
}
