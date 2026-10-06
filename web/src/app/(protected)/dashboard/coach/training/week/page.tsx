import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid, Plus, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { formatInTimezone, formatTime, todayIso } from "@/lib/time";
import { sessionEffort, effortLabel } from "@/lib/session-effort";
import { ThisWeekObjectives } from "@/components/this-week-objectives";
import { loadOpenObjectives } from "@/lib/objectives-data";
import { CurriculumPicker } from "@/components/curriculum/curriculum-picker";
import { curriculumAgeGroupFromTeam, groupForAgeGroup } from "@/lib/curriculum";
import { loadCurriculum, loadLinkedItemIds } from "@/lib/curriculum-data";
import {
  addDays, buildWeekPlan, mondayOf, parseDay,
  type Load, type PlanFixture, type PlanPlay, type PlanSession,
} from "@/lib/week-plan";

const LOAD_LABEL: Record<Load, string> = { 0: "Rest", 1: "Light", 2: "Moderate", 3: "Hard" };
const LOAD_BAR: Record<Load, string> = {
  0: "bg-muted",
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-red-500",
};

/** SAST has no daylight saving, so a fixed offset turns a calendar day into an instant exactly. */
const startOfDay = (day: string) => new Date(`${day}T00:00:00+02:00`).toISOString();

/**
 * The coach's week on one screen (Finalthird's weekly planner): each day's
 * training and match, the plays attached to them, the matchday count
 * (MD-2, MD, MD+1) and how hard each day is, with a warning when the load
 * lands in the wrong place. Reads only data the app already keeps.
 */
export default async function TrainingWeekPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ team?: string; week?: string }>;
}>) {
  const { team: teamParam, week } = await searchParams;
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

  const now = new Date();
  const start = mondayOf(parseDay(week) ?? todayIso(now));
  const end = addDays(start, 6);

  const [{ data: sessionRows }, { data: fixtureRows }, { data: playRows }] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, title, session_date, session_type")
      .eq("team_id", team.id)
      .gte("session_date", startOfDay(start))
      .lt("session_date", startOfDay(addDays(end, 1))),
    // A few days either side, so MD labels at the edges of the week are right.
    supabase
      .from("fixtures")
      .select("id, opponent, fixture_date, is_home, status")
      .eq("team_id", team.id)
      .gte("fixture_date", startOfDay(addDays(start, -2)))
      .lt("fixture_date", startOfDay(addDays(end, 6))),
    supabase
      .from("tactic_plays")
      .select("id, name, session_id, fixture_id")
      .eq("team_id", team.id)
      .or("session_id.not.is.null,fixture_id.not.is.null"),
  ]);

  // The squad's recorded effort per session (migration 057); planned load stands in without it.
  const sessions = (sessionRows ?? []) as PlanSession[];
  if (sessions.length) {
    const { data: effortRows, error } = await supabase
      .from("training_attendance")
      .select("session_id, rpe")
      .in("session_id", sessions.map((s) => s.id));
    if (!error) {
      for (const s of sessions) {
        s.rpe = sessionEffort(((effortRows ?? []) as { session_id: string; rpe: number | null }[])
          .filter((r) => r.session_id === s.id)
          .map((r) => r.rpe ?? null));
      }
    }
  }

  const plan = buildWeekPlan({
    start,
    now,
    sessions,
    fixtures: (fixtureRows ?? []) as PlanFixture[],
    plays: (playRows ?? []) as PlanPlay[],
  });

  const objectives = await loadOpenObjectives(supabase, [team.id]);

  // Optional "which curriculum items is this about?" for each open objective.
  // Hidden when the academy has written none for this age group or migration 068 is missing.
  const curriculumAge = curriculumAgeGroupFromTeam(team.age_group);
  const curriculumGroups = objectives.length > 0 && curriculumAge
    ? groupForAgeGroup((await loadCurriculum(supabase)).items, curriculumAge)
    : [];
  const objectivePickers = curriculumGroups.some((g) => g.items.length > 0)
    ? await Promise.all(objectives.map(async (o) => ({ objective: o, linked: await loadLinkedItemIds(supabase, "objective", o.id) })))
    : [];

  const href = (w: string) => `/dashboard/coach/training/week?team=${team.id}&week=${w}`;
  const dayHeading = (day: string) =>
    formatInTimezone(startOfDay(day), { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/coach/training?team=${team.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Training
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Week plan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {team.name}{team.age_group ? ` · ${team.age_group}` : ""} · {dayHeading(start)} to {dayHeading(end)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={href(addDays(start, -7))} aria-label="Previous week">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(mondayOf(todayIso(now)))}>This week</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(addDays(start, 7))} aria-label="Next week">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <ThisWeekObjectives objectives={objectives} />
      {objectivePickers.map(({ objective, linked }) => (
        <CurriculumPicker
          key={objective.id}
          linkType="objective"
          linkId={objective.id}
          groups={curriculumGroups}
          initialIds={linked}
          title={`Curriculum for: ${objective.objective}`}
        />
      ))}

      {plan.warnings.length > 0 && (
        <ul className="space-y-2">
          {plan.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* Load across the week at a glance */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Load</p>
        <ul className="m-0 grid list-none grid-cols-7 items-end gap-1.5 p-0" aria-label="Load per day">
          {plan.days.map((d) => (
            <li key={d.date} className="flex flex-col items-center gap-1" aria-label={`${dayHeading(d.date)}: ${LOAD_LABEL[d.load]}`}>
              <div className="flex h-16 w-full items-end rounded bg-muted/40">
                <div className={cn("w-full rounded", LOAD_BAR[d.load])} style={{ height: `${Math.max(d.load, 0.25) * 33.3}%` }} />
              </div>
              <span className={cn("text-[11px]", d.isToday ? "font-bold text-foreground" : "text-muted-foreground")}>
                {formatInTimezone(startOfDay(d.date), { weekday: "narrow" })}
              </span>
              {d.matchDay && <span className="text-[10px] font-semibold text-primary">{d.matchDay}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          From the effort you recorded after a session, or from its type until you do. A match counts as hard.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {plan.days.map((d) => (
          <section
            key={d.date}
            aria-label={dayHeading(d.date)}
            className={cn(
              "flex min-h-32 flex-col gap-2 rounded-xl border bg-card p-3",
              d.isToday ? "border-primary" : "border-border"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{dayHeading(d.date)}</p>
              {d.matchDay && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{d.matchDay}</span>
              )}
            </div>

            {d.fixtures.map((f) => (
              <Link
                key={f.id}
                href={`/dashboard/coach/fixtures/${f.id}`}
                className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs hover:bg-red-500/10"
              >
                <span className="flex items-center gap-1 font-semibold">
                  <Trophy className="size-3.5" aria-hidden="true" />
                  {f.is_home ? "vs" : "@"} {f.opponent}
                </span>
                <span className="text-muted-foreground">{formatTime(f.fixture_date)}</span>
                {f.plays.length > 0 && <PlayList plays={f.plays} />}
              </Link>
            ))}

            {d.sessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/coach/training/${s.id}`}
                className="rounded-lg border border-border bg-background p-2 text-xs hover:bg-muted/50"
              >
                <span className="block font-semibold leading-snug">{s.title}</span>
                <span className="text-muted-foreground">
                  {formatTime(s.session_date)} · {LOAD_LABEL[s.load]}
                  {s.loadFrom === "recorded" ? ` (felt ${effortLabel(s.rpe)?.toLowerCase()})` : ""}
                </span>
                {s.plays.length > 0 && <PlayList plays={s.plays} />}
              </Link>
            ))}

            {d.sessions.length === 0 && d.fixtures.length === 0 && (
              <p className="text-xs text-muted-foreground">Rest</p>
            )}

            <Link
              href={`/dashboard/coach/training/new?team=${team.id}`}
              className="mt-auto inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3" aria-hidden="true" />
              Session
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlayList({ plays }: Readonly<{ plays: PlanPlay[] }>) {
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {plays.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
          <LayoutGrid className="size-2.5" aria-hidden="true" />
          {p.name}
        </span>
      ))}
    </span>
  );
}
