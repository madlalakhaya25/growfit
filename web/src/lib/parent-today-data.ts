import type { SupabaseClient } from "@supabase/supabase-js";
import { formsToSign, nextEventFor, type TodayEvent } from "@/lib/parent-today";
import { loadWeekDigests } from "@/lib/family-messages";
import { weekKeyFor } from "@/lib/weekly-digest";
import { todayIso } from "@/lib/time";

export interface ParentTodayChild {
  id: string;
  fullName: string;
  next: TodayEvent | null;
  forms: string[];
  /** This week's coach-approved note for the child, if there is one. */
  note: string | null;
}

/**
 * Per linked child: the next match or session, forms still open, and the week's
 * note. Everything here is read through the parent's own session, so RLS keeps it
 * to their own children; a note is shown only once a coach has approved it.
 * Returns null if the core reads failed, so the page says so instead of showing
 * "nothing coming up".
 */
export async function loadParentToday(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  children: { id: string; fullName: string }[],
  now: Date,
): Promise<ParentTodayChild[] | null> {
  if (children.length === 0) return [];
  const ids = children.map((c) => c.id);
  const season = now.getFullYear().toString();

  const members = await supabase.from("team_members").select("player_id, team_id").in("player_id", ids).eq("active", true);
  if (members.error) return null;
  const teamsOf = new Map<string, Set<string>>();
  for (const m of (members.data ?? []) as { player_id: string; team_id: string }[]) {
    const set = teamsOf.get(m.player_id) ?? new Set<string>();
    set.add(m.team_id);
    teamsOf.set(m.player_id, set);
  }
  const teamIds = [...new Set([...teamsOf.values()].flatMap((s) => [...s]))];

  const nowIso = now.toISOString();
  const [fixtures, sessions, docs, digests] = await Promise.all([
    teamIds.length
      ? supabase.from("fixtures").select("id, team_id, opponent, venue, fixture_date, status, teams ( name )").in("team_id", teamIds).eq("status", "upcoming").gte("fixture_date", nowIso).order("fixture_date").limit(50)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from("training_sessions").select("id, team_id, title, location, session_date").in("team_id", teamIds).gte("session_date", nowIso).order("session_date").limit(50)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("player_documents").select("player_id, document_type, status").in("player_id", ids).eq("season", season),
    loadWeekDigests(supabase, ids, weekKeyFor(todayIso(now))),
  ]);
  if (fixtures.error || sessions.error || docs.error) return null;

  const events: TodayEvent[] = [
    ...((fixtures.data ?? []) as { team_id: string; opponent: string; venue: string | null; fixture_date: string }[]).map((f) => ({
      kind: "match" as const, teamId: f.team_id, title: `vs ${f.opponent}`, at: f.fixture_date, place: f.venue,
    })),
    ...((sessions.data ?? []) as { team_id: string; title: string; location: string | null; session_date: string }[]).map((s) => ({
      kind: "training" as const, teamId: s.team_id, title: s.title, at: s.session_date, place: s.location,
    })),
  ];

  const statusOf = new Map<string, Map<string, string>>();
  for (const d of (docs.data ?? []) as { player_id: string; document_type: string; status: string }[]) {
    const m = statusOf.get(d.player_id) ?? new Map<string, string>();
    m.set(d.document_type, d.status);
    statusOf.set(d.player_id, m);
  }

  return children.map((c) => {
    const digest = digests.byPlayer.get(c.id);
    return {
      id: c.id,
      fullName: c.fullName,
      next: nextEventFor(events, teamsOf.get(c.id) ?? new Set(), now),
      forms: formsToSign(statusOf.get(c.id) ?? new Map()),
      note: digest?.status === "approved" ? digest.body : null,
    };
  });
}
