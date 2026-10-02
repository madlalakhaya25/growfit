/**
 * The coach's week at a glance: what training is planned in the next seven
 * days, what the next match is, and whether anything is missing. Pure, and the
 * clock is passed in, so it can be tested and never reads the time during render.
 */

export interface BriefSession {
  id: string;
  title: string;
  session_date: string;
}

export interface BriefFixture {
  id: string;
  opponent: string;
  fixture_date: string;
}

export interface WeekBrief {
  /** Sessions starting within the next seven days, soonest first. */
  sessions: BriefSession[];
  /** The next match, if it is within the next seven days. */
  fixture: BriefFixture | null;
  /** True when a match is coming and no training is planned before it. */
  trainingGap: boolean;
}

const WEEK_MS = 7 * 86_400_000;

export function buildWeekBrief(now: Date, sessions: BriefSession[], fixtures: BriefFixture[]): WeekBrief {
  const start = now.getTime();
  const end = start + WEEK_MS;
  const inWeek = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };

  const week = sessions
    .filter((s) => inWeek(s.session_date))
    .sort((a, b) => a.session_date.localeCompare(b.session_date));
  const fixture =
    fixtures
      .filter((f) => inWeek(f.fixture_date))
      .sort((a, b) => a.fixture_date.localeCompare(b.fixture_date))[0] ?? null;

  const trainingGap = fixture
    ? !week.some((s) => new Date(s.session_date).getTime() <= new Date(fixture.fixture_date).getTime())
    : false;

  return { sessions: week, fixture, trainingGap };
}
