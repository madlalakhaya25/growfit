import type { SupabaseClient } from "@supabase/supabase-js";
import { countsAsAttended, isAttendanceStatus } from "@/lib/attendance";
import { pickHomeChallenge } from "@/lib/home-challenge";
import { loadOpenObjectives } from "@/lib/objectives-data";
import { loadSharedDevelopmentPlan } from "@/lib/shared-development-plan";
import { formatWeekdayDayMonth } from "@/lib/time";
import { teamFocusText, type DigestPlayerFacts } from "@/lib/weekly-digest";

const DAY_MS = 86_400_000;

type Client = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * What the week holds for every active child on a team: the sessions and
 * matches they were at (Monday to Sunday of `weekKey`, academy time), the team's
 * next fixture, and one action from their own approved plan. Read-only. A read
 * that fails leaves that part empty, so a note only ever says what the app can
 * stand behind.
 */
export async function loadDigestFacts(supabase: Client, teamId: string, weekKey: string, now: Date): Promise<DigestPlayerFacts[]> {
  const from = new Date(`${weekKey}T00:00:00+02:00`);
  const to = new Date(from.getTime() + 7 * DAY_MS);
  // Sessions and matches still to come this week are not "this week" yet.
  const end = new Date(Math.min(to.getTime(), now.getTime()));

  const { data: members } = await supabase.from("team_members").select("players ( id, full_name )").eq("team_id", teamId).eq("active", true);
  type Person = { id: string; full_name: string };
  const roster = ((members ?? []) as unknown as { players: Person | Person[] | null }[])
    .flatMap((m) => [m.players ?? []].flat())
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id));
  if (roster.length === 0) return [];
  const ids = roster.map((p) => p.id);

  const [{ data: sessions }, { data: fixtures }, { data: upcoming }] = await Promise.all([
    supabase.from("training_sessions").select("id").eq("team_id", teamId).gte("session_date", from.toISOString()).lte("session_date", end.toISOString()),
    supabase.from("fixtures").select("id").eq("team_id", teamId).gte("fixture_date", from.toISOString()).lte("fixture_date", end.toISOString()),
    supabase.from("fixtures").select("opponent, fixture_date").eq("team_id", teamId).eq("status", "upcoming")
      .gt("fixture_date", now.toISOString()).order("fixture_date", { ascending: true }).limit(1),
  ]);
  const sessionIds = ((sessions ?? []) as { id: string }[]).map((s) => s.id);
  const fixtureIds = ((fixtures ?? []) as { id: string }[]).map((f) => f.id);

  const attended = new Map<string, number>();
  if (sessionIds.length) {
    const { data } = await supabase.from("training_attendance").select("player_id, status").in("session_id", sessionIds).in("player_id", ids);
    for (const r of (data ?? []) as { player_id: string; status: string }[]) {
      if (isAttendanceStatus(r.status) && countsAsAttended(r.status)) attended.set(r.player_id, (attended.get(r.player_id) ?? 0) + 1);
    }
  }
  const played = new Map<string, number>();
  if (fixtureIds.length) {
    const { data } = await supabase.from("match_appearances").select("player_id, played").in("fixture_id", fixtureIds).in("player_id", ids);
    for (const r of (data ?? []) as { player_id: string; played: boolean }[]) {
      if (r.played) played.set(r.player_id, (played.get(r.player_id) ?? 0) + 1);
    }
  }

  const next = ((upcoming ?? []) as { opponent: string; fixture_date: string }[])[0];
  const nextFixture = next ? { opponent: next.opponent, when: formatWeekdayDayMonth(next.fixture_date) } : null;

  // The team's own line: only the phase of play, only where a session was planned for it.
  const objectives = await loadOpenObjectives(supabase, [teamId]);
  const teamFocus = teamFocusText(objectives.filter((o) => o.linkedCount > 0).map((o) => o.phase));

  const plans = await Promise.all(ids.map((id) => loadSharedDevelopmentPlan(supabase, id)));
  return roster.map((p, i) => {
    const challenge = plans[i] ? pickHomeChallenge(plans[i]!.plan, now) : null;
    return {
      playerId: p.id,
      fullName: p.full_name,
      sessionsHeld: sessionIds.length,
      sessionsAttended: attended.get(p.id) ?? 0,
      matchesPlayed: played.get(p.id) ?? 0,
      nextFixture,
      teamFocus,
      homeChallenge: challenge ? { what: challenge.action.what, how: challenge.action.how, timesPerWeek: challenge.action.timesPerWeek } : null,
    };
  });
}
