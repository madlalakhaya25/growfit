// What the director and technical director cards say on the admin's Today page
// (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md, Part 2). Everything is
// computed from data coaches already entered; nothing is typed in. Pure, so the
// same data always gives the same cards.

import { objectiveDebt, type OpenObjective } from "@/lib/objectives";
import type { AgeGroupCoverage, CoverageWindow } from "@/lib/curriculum-coverage";

export interface TeamRef {
  id: string;
  name: string;
}

export interface TeamObjectiveLine {
  teamId: string;
  name: string;
  open: number;
  /** Open for a week or more with no session planned for it. */
  noTrainingYet: number;
}

/** Open objectives per team, teams with none left out, those with the most waiting first. */
export function objectivesByTeam(teams: readonly TeamRef[], open: readonly OpenObjective[], today: string): TeamObjectiveLine[] {
  const waiting = new Set(
    objectiveDebt(
      open.map((o) => ({
        id: o.id, status: "open" as const, createdAt: o.createdAt, sourceFixtureId: o.sourceFixtureId, verdict: null, linkedCount: o.linkedCount,
      })),
      [],
      today,
    ).map((d) => d.objectiveId),
  );
  return teams
    .map((t) => {
      const mine = open.filter((o) => o.teamId === t.id);
      return { teamId: t.id, name: t.name, open: mine.length, noTrainingYet: mine.filter((o) => waiting.has(o.id)).length };
    })
    .filter((l) => l.open > 0)
    .sort((a, b) => b.noTrainingYet - a.noTrainingYet || b.open - a.open || a.name.localeCompare(b.name));
}

export interface TeamSessionLine {
  teamId: string;
  name: string;
  sessions: number;
}

/** Sessions held per team inside the window (YYYY-MM-DD, inclusive), the fewest first so a quiet team shows up. */
export function sessionsByTeam(
  teams: readonly TeamRef[],
  sessions: readonly { teamId: string; date: string }[],
  window: CoverageWindow,
): TeamSessionLine[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (s.date < window.from || s.date > window.to) continue;
    counts.set(s.teamId, (counts.get(s.teamId) ?? 0) + 1);
  }
  return teams
    .map((t) => ({ teamId: t.id, name: t.name, sessions: counts.get(t.id) ?? 0 }))
    .sort((a, b) => a.sessions - b.sessions || a.name.localeCompare(b.name));
}

export interface CoverageHeadline {
  ageGroup: string;
  percent: number;
  /** Curriculum items with no session in the window. */
  notTouched: number;
  items: number;
}

/** One line per age group: how much of the curriculum was trained, and how much was not touched. */
export function coverageHeadlines(groups: readonly AgeGroupCoverage[]): CoverageHeadline[] {
  return groups.map((g) => ({
    ageGroup: g.ageGroup,
    percent: g.coveragePercent,
    notTouched: g.notTouched.length,
    items: g.categories.reduce((n, c) => n + c.items.length, 0),
  }));
}
