import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTENDANCE_WINDOW_DAYS, countsAsAttended, isAttendanceStatus } from "@/lib/attendance";
import {
  readiness, type MatchEntry, type RatingEntry, type Readiness, type SessionEntry,
} from "@/lib/readiness";

const DAY_MS = 86_400_000;

type Client = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

async function loadSessions(supabase: Client, sessionDate: Map<string, string>, ids: string[]) {
  const sessionsBy = new Map<string, SessionEntry[]>();
  let effortRecorded = false;
  if (sessionDate.size === 0) return { sessionsBy, effortRecorded };
  const sessionIds = [...sessionDate.keys()];
  type Row = { session_id: string; player_id: string; status: string; rpe?: number | null };
  const wide = await supabase.from("training_attendance").select("session_id, player_id, status, rpe").in("session_id", sessionIds).in("player_id", ids);
  const rows: Row[] = wide.error
    ? (((await supabase.from("training_attendance").select("session_id, player_id, status").in("session_id", sessionIds).in("player_id", ids)).data ?? []) as Row[])
    : ((wide.data ?? []) as Row[]);
  for (const row of rows) {
    if (!isAttendanceStatus(row.status)) continue;
    const rpe = row.rpe ?? null;
    if (rpe !== null) effortRecorded = true;
    pushTo(sessionsBy, row.player_id, { date: sessionDate.get(row.session_id)!, attended: countsAsAttended(row.status), rpe });
  }
  return { sessionsBy, effortRecorded };
}

async function loadMatches(supabase: Client, fixtureDate: Map<string, string>, ids: string[]) {
  const matchesBy = new Map<string, MatchEntry[]>();
  if (fixtureDate.size === 0) return matchesBy;
  const { data } = await supabase.from("match_appearances").select("fixture_id, player_id, played").in("fixture_id", [...fixtureDate.keys()]).in("player_id", ids);
  for (const row of (data ?? []) as { fixture_id: string; player_id: string; played: boolean }[]) {
    pushTo(matchesBy, row.player_id, { date: fixtureDate.get(row.fixture_id)!, played: row.played });
  }
  return matchesBy;
}

/**
 * Readiness for each listed player on one team, from what the coach has already
 * recorded. Read-only, and never fails the page: a missing effort column
 * (migration 057 not run yet) just means load can't be judged, and any other
 * read error leaves that part empty, so readiness only ever shows what it can
 * stand behind.
 *
 * `attendancePct` comes from the caller, who has already computed it with the
 * academy's one attendance policy, so this does not compute a second figure.
 */
export async function loadReadiness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  ageGroup: string | null,
  players: { id: string; attendancePct: number | null }[],
  now: Date = new Date(),
): Promise<{ byPlayer: Map<string, Readiness>; effortRecorded: boolean }> {
  const byPlayer = new Map<string, Readiness>();
  if (players.length === 0) return { byPlayer, effortRecorded: false };
  const ids = players.map((p) => p.id);
  const since = new Date(now.getTime() - ATTENDANCE_WINDOW_DAYS * DAY_MS).toISOString();

  const [{ data: sessions }, { data: fixtures }, { data: ratingRows }] = await Promise.all([
    supabase.from("training_sessions").select("id, session_date").eq("team_id", teamId).gte("session_date", since),
    supabase.from("fixtures").select("id, fixture_date").eq("team_id", teamId).gte("fixture_date", since).lte("fixture_date", now.toISOString()),
    supabase.from("player_ratings").select("player_id, rating, created_at").in("player_id", ids).gte("created_at", since),
  ]);

  const sessionDate = new Map(((sessions ?? []) as { id: string; session_date: string }[]).map((s) => [s.id, s.session_date]));
  const fixtureDate = new Map(((fixtures ?? []) as { id: string; fixture_date: string }[]).map((f) => [f.id, f.fixture_date]));

  const { sessionsBy, effortRecorded } = await loadSessions(supabase, sessionDate, ids);
  const matchesBy = await loadMatches(supabase, fixtureDate, ids);

  const ratingsBy = new Map<string, RatingEntry[]>();
  for (const row of (ratingRows ?? []) as { player_id: string; rating: number; created_at: string }[]) {
    pushTo(ratingsBy, row.player_id, { date: row.created_at, rating: row.rating });
  }

  for (const p of players) {
    byPlayer.set(p.id, readiness({
      ageGroup,
      sessions: sessionsBy.get(p.id) ?? [],
      matches: matchesBy.get(p.id) ?? [],
      ratings: ratingsBy.get(p.id) ?? [],
      attendancePct: p.attendancePct,
    }, now));
  }
  return { byPlayer, effortRecorded };
}
