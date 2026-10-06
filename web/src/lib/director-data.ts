// Loaders for the director and technical director cards on the admin's Today
// page. They run through the signed-in admin's session, so row security decides
// what is read. Each card loads only when it is shown, and a failed or missing
// source gives null for that card (it is hidden) and never blocks the page.

import type { createClient } from "@/lib/supabase/server";
import { loadCurriculum, loadCoverageInputs } from "@/lib/curriculum-data";
import { computeCoverage, coverageWindow } from "@/lib/curriculum-coverage";
import { loadOpenObjectives } from "@/lib/objectives-data";
import {
  coverageHeadlines, objectivesByTeam, sessionsByTeam,
  type CoverageHeadline, type TeamObjectiveLine, type TeamRef, type TeamSessionLine,
} from "@/lib/director-cards";
import { addDays } from "@/lib/week-plan";
import { todayIso } from "@/lib/time";
import type { AdminCard } from "@/lib/staff-hats";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface WeekFixture {
  teamName: string;
  opponent: string;
  /** ISO kickoff time. */
  kickoff: string;
}

export interface DirectorCards {
  objectives: TeamObjectiveLine[] | null;
  fixtures: WeekFixture[] | null;
  sessions: TeamSessionLine[] | null;
  coverage: CoverageHeadline[] | null;
}

async function termWindow(supabase: Supabase, today: string) {
  const { data } = await supabase.from("academy_terms").select("starts_on, ends_on");
  return coverageWindow((data ?? []) as { starts_on: string; ends_on: string }[], today);
}

async function loadFixtures(supabase: Supabase, teams: TeamRef[], now: Date): Promise<WeekFixture[] | null> {
  const { data, error } = await supabase
    .from("fixtures")
    .select("team_id, opponent, fixture_date")
    .in("team_id", teams.map((t) => t.id))
    .eq("status", "upcoming")
    .gte("fixture_date", now.toISOString())
    .lt("fixture_date", new Date(now.getTime() + 7 * 86_400_000).toISOString())
    .order("fixture_date");
  if (error) return null;
  const name = new Map(teams.map((t) => [t.id, t.name]));
  return ((data ?? []) as { team_id: string; opponent: string; fixture_date: string }[]).map((f) => ({
    teamName: name.get(f.team_id) ?? "Team",
    opponent: f.opponent,
    kickoff: f.fixture_date,
  }));
}

async function loadSessions(supabase: Supabase, teams: TeamRef[], today: string): Promise<TeamSessionLine[] | null> {
  const window = await termWindow(supabase, today);
  const { data, error } = await supabase
    .from("training_sessions")
    .select("team_id, session_date")
    .in("team_id", teams.map((t) => t.id))
    .gte("session_date", window.from);
  if (error) return null;
  const rows = ((data ?? []) as { team_id: string; session_date: string }[])
    .map((r) => ({ teamId: r.team_id, date: todayIso(new Date(r.session_date)) }));
  return sessionsByTeam(teams, rows, window);
}

async function loadCoverage(supabase: Supabase, today: string): Promise<CoverageHeadline[] | null> {
  const curriculum = await loadCurriculum(supabase);
  if (!curriculum.available || curriculum.items.length === 0) return null;
  const [inputs, window] = await Promise.all([loadCoverageInputs(supabase), termWindow(supabase, today)]);
  return coverageHeadlines(computeCoverage(curriculum.items, inputs.links, inputs.sessions, window));
}

export async function loadDirectorCards(
  supabase: Supabase,
  teams: TeamRef[],
  cards: readonly AdminCard[],
  now: Date = new Date(),
): Promise<DirectorCards> {
  const today = todayIso(now);
  const none = teams.length === 0;
  const [objectives, fixtures, sessions, coverage] = await Promise.all([
    cards.includes("objectives") && !none ? loadOpenObjectives(supabase, teams.map((t) => t.id)) : null,
    cards.includes("fixtures") && !none ? loadFixtures(supabase, teams, now) : null,
    cards.includes("sessions") && !none ? loadSessions(supabase, teams, today) : null,
    cards.includes("coverage") ? loadCoverage(supabase, today) : null,
  ]);
  return {
    objectives: objectives ? objectivesByTeam(teams, objectives, today) : null,
    fixtures,
    sessions,
    coverage,
  };
}
