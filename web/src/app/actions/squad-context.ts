"use server";

import { requireUser } from "@/lib/auth";
import { POSITIONS } from "@/lib/types";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { calculateAge } from "@/lib/player";
import { attendancePct, isBelowWelfareThreshold, ATTENDANCE_WINDOW_DAYS, WELFARE_ATTENDANCE_THRESHOLD } from "@/lib/attendance";

/**
 * Assembles the real squad into a compact text brief the AI features share.
 *
 * Every AI feature before this was either generic or looked at one thing in
 * isolation. This gives them the actual picture — who is in the squad, how they
 * are rated, who is turning up to training, what is coming up, and how the last
 * matches went — so advice cites real players and real numbers.
 *
 * Kept as text (not JSON) because it goes straight into a prompt, and text
 * costs fewer tokens and reads better to the model.
 */

export interface SquadContext {
  teamName: string;
  ageGroup: string;
  brief: string;
  playerCount: number;
}

const posLabel = (v: string | null) =>
  POSITIONS.find((p) => p.value === v)?.label ?? "unknown position";

export async function buildSquadContext(
  teamId: string,
  opts?: { fixtureId?: string }
): Promise<{ context?: SquadContext; error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, age_group")
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .single();
  if (!team) return { error: "You don't coach this team." };

  // Squad with ratings and attributes
  const { data: members } = await supabase
    .from("team_members")
    .select(`
      players (
        id, full_name, position, date_of_birth,
        player_ratings ( rating, created_at ),
        player_attributes ( pace, shooting, passing, dribbling, defending, physical )
      )
    `)
    .eq("team_id", teamId)
    .eq("active", true);

  type Rating = { rating: number; created_at: string };
  type Attr = { pace: number; shooting: number; passing: number; dribbling: number; defending: number; physical: number };
  type Player = {
    id: string; full_name: string; position: string | null; date_of_birth: string | null;
    player_ratings: Rating[] | null; player_attributes: Attr[] | null;
  };

  const players: Player[] = (members ?? [])
    .flatMap((m: { players: Player | Player[] | null }) =>
      m.players ? (Array.isArray(m.players) ? m.players : [m.players]) : []
    );

  if (players.length === 0) {
    return { error: "This team has no players yet." };
  }

  const playerIds = players.map((p) => p.id);

  // Training attendance across the recent term
  const since = new Date(Date.now() - ATTENDANCE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("team_id", teamId)
    .gte("session_date", since);
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);

  const attendanceByPlayer = new Map<string, { present: number }>();
  if (sessionIds.length > 0) {
    const { data: att } = await supabase
      .from("training_attendance")
      .select("player_id, status")
      .in("session_id", sessionIds)
      .in("player_id", playerIds);
    for (const row of (att ?? []) as { player_id: string; status: string }[]) {
      const rec = attendanceByPlayer.get(row.player_id) ?? { present: 0 };
      if (row.status === "attending") rec.present += 1;
      attendanceByPlayer.set(row.player_id, rec);
    }
  }

  // Recent results, and anything already played against this fixture's opponent
  const { data: recent } = await supabase
    .from("fixtures")
    .select("opponent, fixture_date, is_home, status, match_results ( team_score, opponent_score, match_notes )")
    .eq("team_id", teamId)
    .eq("status", "completed")
    .order("fixture_date", { ascending: false })
    .limit(6);

  let upcoming: { opponent: string; fixture_date: string; is_home: boolean } | null = null;
  if (opts?.fixtureId) {
    const { data: fx } = await supabase
      .from("fixtures")
      .select("opponent, fixture_date, is_home")
      .eq("id", opts.fixtureId)
      .single();
    upcoming = fx ?? null;
  }

  // ── Build the brief ──────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`TEAM: ${team.name}${team.age_group ? ` (${team.age_group})` : ""} — ${players.length} registered players.`);

  lines.push("", "SQUAD:");
  for (const p of players) {
    const ratings = p.player_ratings ?? [];
    const avg = ratings.length
      ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
      : "unrated";
    const recent5 = [...ratings]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5);
    const form = recent5.length
      ? (recent5.reduce((s, r) => s + r.rating, 0) / recent5.length).toFixed(1)
      : "n/a";

    const present = attendanceByPlayer.get(p.id)?.present ?? 0;
    const attPct = attendancePct(present, sessionIds.length);

    const age = calculateAge(p.date_of_birth);

    const a = (p.player_attributes ?? [])[0];
    const attrs = a
      ? ` | pace ${a.pace}, shooting ${a.shooting}, passing ${a.passing}, dribbling ${a.dribbling}, defending ${a.defending}, physical ${a.physical}`
      : "";

    lines.push(
      `- ${p.full_name} — ${posLabel(p.position)}${age ? `, age ${age}` : ""} | avg rating ${avg}/5 (${ratings.length} rated), recent form ${form}/5` +
      (attPct !== null ? ` | training attendance ${attPct}%${isBelowWelfareThreshold(present, sessionIds.length) ? " (BELOW the 75% policy threshold)" : ""}` : "") +
      attrs
    );
  }

  // Squad averages — lets advice cite real numbers rather than generalities
  const withAttrs = players.map((p) => (p.player_attributes ?? [])[0]).filter(Boolean) as Attr[];
  if (withAttrs.length > 0) {
    const mean = (k: keyof Attr) =>
      Math.round(withAttrs.reduce((s, r) => s + r[k], 0) / withAttrs.length);
    lines.push(
      "",
      `SQUAD AVERAGES (out of 100): pace ${mean("pace")}, shooting ${mean("shooting")}, passing ${mean("passing")}, dribbling ${mean("dribbling")}, defending ${mean("defending")}, physical ${mean("physical")}.`
    );
  }

  if (sessionIds.length > 0) {
    const below = players.filter((p) => {
      const present = attendanceByPlayer.get(p.id)?.present ?? 0;
      return isBelowWelfareThreshold(present, sessionIds.length);
    });
    lines.push(
      `TRAINING: ${sessionIds.length} sessions in the last ${ATTENDANCE_WINDOW_DAYS} days. ${below.length} player(s) below the ${Math.round(WELFARE_ATTENDANCE_THRESHOLD * 100)}% attendance threshold${below.length ? `: ${below.map((p) => p.full_name).join(", ")}` : ""}.`
    );
  }

  type ResultRow = {
    opponent: string; fixture_date: string; is_home: boolean;
    match_results: { team_score: number; opponent_score: number; match_notes: string | null }
      | { team_score: number; opponent_score: number; match_notes: string | null }[] | null;
  };
  const results = (recent ?? []) as ResultRow[];
  /** Scores live in match_results, one row per fixture. */
  const scoreOf = (r: ResultRow) => {
    const mr = Array.isArray(r.match_results) ? r.match_results[0] : r.match_results;
    return mr ? `${mr.team_score}-${mr.opponent_score}` : "score not logged";
  };

  if (results.length > 0) {
    lines.push("", "RECENT RESULTS (most recent first):");
    for (const r of results) {
      lines.push(`- ${new Date(r.fixture_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} ${r.is_home ? "vs" : "away to"} ${r.opponent}: ${scoreOf(r)}`);
    }
  }

  if (upcoming) {
    lines.push("", `NEXT MATCH: ${upcoming.is_home ? "home vs" : "away to"} ${upcoming.opponent} on ${new Date(upcoming.fixture_date).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}.`);

    // Opponent memory — what happened last time we played them
    const history = results.filter((r) => r.opponent.toLowerCase() === upcoming!.opponent.toLowerCase());
    if (history.length > 0) {
      lines.push("PREVIOUS MEETINGS WITH THIS OPPONENT:");
      for (const h of history) {
        const mr = Array.isArray(h.match_results) ? h.match_results[0] : h.match_results;
        lines.push(
          `- ${new Date(h.fixture_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}: ${scoreOf(h)}` +
          (mr?.match_notes ? ` — notes: ${mr.match_notes.slice(0, 200)}` : "")
        );
      }
    } else {
      lines.push("We have no logged result against this opponent yet.");
    }
  }

  return {
    context: {
      teamName: team.name,
      ageGroup: team.age_group ?? "U15",
      brief: lines.join("\n"),
      playerCount: players.length,
    },
  };
}
