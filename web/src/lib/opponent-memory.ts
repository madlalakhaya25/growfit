/**
 * What the academy already knows about an opponent: the fixtures it has played
 * against them.
 *
 * Matching is on the opponent's NAME, normalised for case and whitespace and
 * nothing more -- never fuzzy. A miss is safe (the brief says there is no
 * logged result); a wrong match is not (it would tell a coach what happened
 * "last time" against a different club). "Rovers" and "Rovers FC" are
 * therefore different opponents until a person makes the names agree.
 */
export function normaliseOpponent(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

type ResultRow = { team_score: number; opponent_score: number; match_notes: string | null };

export interface OpponentFixtureRow {
  id: string;
  opponent: string;
  fixture_date: string;
  is_home: boolean;
  status: string;
  match_results: ResultRow | ResultRow[] | null;
}

export interface Meeting {
  fixtureId: string;
  date: string;
  isHome: boolean;
  /** Null when the fixture is marked completed but no score was logged. */
  score: { team: number; opponent: number } | null;
  notes: string | null;
}

const NOTE_LIMIT = 200;

/**
 * Past completed fixtures against `opponent`, newest first.
 *
 * Sorted by date then id so the order is deterministic whatever order the
 * database returned -- the brief built from this is fingerprinted for the
 * answer cache, and an unstable order would make it never hit.
 */
export function selectMeetings(
  fixtures: readonly OpponentFixtureRow[],
  opponent: string,
  opts: { excludeFixtureId?: string; limit?: number } = {}
): Meeting[] {
  const want = normaliseOpponent(opponent);
  if (!want) return [];
  return fixtures
    .filter((f) => f.status === "completed" && f.id !== opts.excludeFixtureId && normaliseOpponent(f.opponent) === want)
    .sort((a, b) => b.fixture_date.localeCompare(a.fixture_date) || a.id.localeCompare(b.id))
    .slice(0, opts.limit ?? 5)
    .map((f) => {
      const mr = Array.isArray(f.match_results) ? f.match_results[0] : f.match_results;
      return {
        fixtureId: f.id,
        date: f.fixture_date,
        isHome: f.is_home,
        score: mr ? { team: mr.team_score, opponent: mr.opponent_score } : null,
        notes: mr?.match_notes ? mr.match_notes.slice(0, NOTE_LIMIT) : null,
      };
    });
}
