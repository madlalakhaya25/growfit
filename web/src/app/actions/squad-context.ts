"use server";

import { requireUser } from "@/lib/auth";
import { POSITIONS } from "@/lib/types";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { calculateAge } from "@/lib/player";
import { attendancePct, isBelowWelfareThreshold, ATTENDANCE_WINDOW_DAYS, WELFARE_ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import {
  ALL_ATTR_SELECT, CORE_ATTR_SELECT, ALL_ATTR_KEYS, ATTR_META,
  buildAttributeSnapshot, describeAttributes, isMissingAttributeColumn,
  type AttrKey,
} from "@/lib/attributes";
import { friendlyError } from "@/lib/friendly-error";

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

  // Squad with ratings and attributes.
  //
  // This used to select the six migration-001 attribute columns only. Those
  // are `NOT NULL DEFAULT 50`, and the 24 attributes added by migrations 013
  // and 033 — the whole tactical, mental and leadership corners, and every
  // goalkeeper attribute — were not read at all. So a keeper assessed on
  // shot-stopping, reflexes, handling and distribution reached the model as
  // `shooting 50, passing 50, dribbling 50, defending 50`: four numbers
  // nobody was ever asked for, because a keeper's assessment form never
  // shows those sliders. `physical` is in no position's set at all, so it
  // was always exactly 50 for everyone.
  //
  // Every prompt in this app tells the model never to invent a statistic.
  // The brief has to hold up its end of that, so it now reads all 30
  // columns and reports only what a coach actually rated — see
  // buildAttributeSnapshot().
  // Both selects are spelled out as literals rather than built from a
  // variable. supabase-js parses the select string in the *type* system, so
  // interpolating a runtime `string` erases to `string` and collapses the
  // whole query's inferred row type into a ParserError — the same trap
  // `ALL_ATTR_SELECT`'s own comment in lib/attributes.ts warns about. A
  // const string literal keeps the inference intact.
  const wide = await supabase
    .from("team_members")
    .select(`
      players (
        id, full_name, position, date_of_birth,
        player_ratings ( rating, created_at ),
        player_attributes ( ${ALL_ATTR_SELECT} )
      )
    `)
    .eq("team_id", teamId)
    .eq("active", true);

  // A project that never ran migration 013/033 has none of the expanded
  // columns, and a wide SELECT naming a missing column fails outright rather
  // than returning the ones that exist (42703) — which would read as "this
  // team has no players" here. Same fallback the player-facing surfaces use.
  const narrow = isMissingAttributeColumn(wide.error)
    ? await supabase
        .from("team_members")
        .select(`
          players (
            id, full_name, position, date_of_birth,
            player_ratings ( rating, created_at ),
            player_attributes ( ${CORE_ATTR_SELECT} )
          )
        `)
        .eq("team_id", teamId)
        .eq("active", true)
    : null;

  const result = narrow ?? wide;
  if (result.error) {
    console.error("[squad context] failed to load squad:", result.error);
    return { error: friendlyError(result.error) };
  }

  type Rating = { rating: number; created_at: string };
  type Attr = Partial<Record<AttrKey, number | null>>;
  type Player = {
    id: string; full_name: string; position: string | null; date_of_birth: string | null;
    player_ratings: Rating[] | null; player_attributes: Attr[] | null;
  };

  const players: Player[] = ((result.data ?? []) as unknown as { players: Player | Player[] | null }[])
    .flatMap((m) =>
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

    // Averaged across every coach who has assessed this player, filtered to
    // the attributes their position is actually rated on. `null` where
    // nobody has assessed them — stated plainly rather than papered over
    // with the schema's default of 50.
    const snapshot = buildAttributeSnapshot(p.player_attributes, p.position);
    const described = describeAttributes(snapshot);
    const attrs = described
      ? ` | ability (1-99, avg of ${snapshot.coachCount} coach${snapshot.coachCount === 1 ? "" : "es"}): ${described}` +
        (snapshot.overall !== null ? ` | overall ${snapshot.overall}` : "")
      : " | ability: NOT ASSESSED — no coach has rated this player's attributes yet";

    lines.push(
      `- ${p.full_name} — ${posLabel(p.position)}${age ? `, age ${age}` : ""} | avg rating ${avg}/5 (${ratings.length} rated), recent form ${form}/5` +
      (attPct !== null ? ` | training attendance ${attPct}%${isBelowWelfareThreshold(present, sessionIds.length) ? " (BELOW the 75% policy threshold)" : ""}` : "") +
      attrs
    );
  }

  // Squad averages — lets advice cite real numbers rather than generalities.
  //
  // Averaged over the players actually rated on each attribute, not over the
  // whole squad: a keeper is not rated on finishing, and counting them as a
  // zero (or as the schema's default 50) would drag the number toward a
  // figure describing nobody. An attribute no one has been rated on is
  // omitted entirely rather than reported as 50.
  const snapshots = players.map((p) => ({
    position: p.position,
    snapshot: buildAttributeSnapshot(p.player_attributes, p.position),
  }));
  const assessedCount = snapshots.filter((s) => s.snapshot.assessedKeys.length > 0).length;

  if (assessedCount > 0) {
    const totals = new Map<AttrKey, { sum: number; n: number }>();
    for (const { snapshot } of snapshots) {
      for (const key of snapshot.assessedKeys) {
        const t = totals.get(key) ?? { sum: 0, n: 0 };
        t.sum += snapshot.assessed[key]!;
        t.n += 1;
        totals.set(key, t);
      }
    }
    const parts = ALL_ATTR_KEYS.filter((k) => totals.has(k)).map((k) => {
      const t = totals.get(k)!;
      return `${ATTR_META[k].label.toLowerCase()} ${Math.round(t.sum / t.n)} (${t.n} rated)`;
    });
    lines.push(
      "",
      `SQUAD AVERAGES (1-99, over the players rated on each attribute): ${parts.join(", ")}.`,
      `${assessedCount} of ${players.length} players have an ability assessment.`
    );
  } else {
    lines.push(
      "",
      "SQUAD AVERAGES: none — no player in this squad has an ability assessment yet. Do not estimate attribute numbers; say they need assessing."
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
