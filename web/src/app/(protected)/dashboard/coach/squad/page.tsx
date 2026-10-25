import Link from "next/link";
import { loadReadiness } from "@/lib/readiness-data";
import { redirect } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KitAvatar } from "@/components/ui/kit-avatar";
import { cn } from "@/lib/utils";
import { RemovePlayerButton } from "./remove-player-button";
import { SquadToolsMenu } from "./squad-tools-menu";
import { attendanceStreak, positionShort, squadStatus } from "@/lib/squad-status";
import { POSITIONS } from "@/lib/types";
import { calculateAge } from "@/lib/player";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import {
  ALL_ATTR_SELECT, CORE_ATTR_SELECT,
  buildAttributeSnapshot, isMissingAttributeColumn, type AttrKey,
} from "@/lib/attributes";
import {
  attendanceWindowStart, isAttendanceStatus, summariseAttendance,
  type AttendanceStatus,
} from "@/lib/attendance";
import { DOCUMENTS } from "@/lib/document-definitions";
import { SquadFilters, type SquadFilter } from "./squad-filters";
import { ResultCount } from "@/components/ui/filter-chip";
import { reportError } from "@/lib/report-error";
import { loadSeasonMinutes } from "@/lib/match-minutes";
import { signPlayerPhotoUrls } from "@/lib/player-photo";
import { getAuthUser } from "@/lib/auth";

/** Every document a player owes per season — the document hub's own list. */
const REQUIRED_DOC_COUNT = DOCUMENTS.length;

export default async function SquadPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; q?: string; filter?: string }>;
}) {
  const { team: teamParam, q: rawQuery = "", filter: rawFilter } = await searchParams;
  const query = rawQuery.trim().toLowerCase();
  const filter: SquadFilter =
    rawFilter === "attendance" || rawFilter === "docs" || rawFilter === "injured" || rawFilter === "unassessed"
      ? rawFilter
      : "all";
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, age_group, invite_code")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = (await resolveCurrentTeamFromCookies(allTeams, teamParam)) ?? allTeams[0];

  // Capture and check the error rather than only destructuring data — a
  // failed query and a genuinely empty squad both leave `members` null/[],
  // and silently rendering "No players yet, add your first player" for a
  // real failure sent a coach looking at a squad the dashboard card had just
  // correctly counted straight into re-adding players who were already
  // there. See the identical fix on the player dashboard for the mechanism
  // this most plausibly was: a lagging migration failing a query outright
  // rather than degrading — this query doesn't touch the attribute columns
  // that bit that page, but the same "never let data go silently null" rule
  // applies to any query whose failure could be mistaken for an empty state.
  //
  // Attributes come along for the ride so each card can show the same
  // Overall every other surface shows. Both selects are spelled out as
  // literals: supabase-js parses the select string in the type system, so
  // interpolating a runtime string collapses the row type to a ParserError
  // (see ALL_ATTR_SELECT's own note in lib/attributes.ts).
  const wide = await supabase
    .from("team_members")
    .select(`
      player_id, joined_at,
      players (
        id, full_name, position, preferred_foot, date_of_birth, photo_url,
        player_ratings ( rating ),
        player_attributes ( ${ALL_ATTR_SELECT} )
      )
    `)
    .eq("team_id", team.id)
    .eq("active", true)
    .order("joined_at");

  // A project missing migration 013/033 fails the wide select outright
  // (42703) rather than returning the columns that do exist.
  const narrow = isMissingAttributeColumn(wide.error)
    ? await supabase
        .from("team_members")
        .select(`
          player_id, joined_at,
          players (
            id, full_name, position, preferred_foot, date_of_birth, photo_url,
            player_ratings ( rating ),
            player_attributes ( ${CORE_ATTR_SELECT} )
          )
        `)
        .eq("team_id", team.id)
        .eq("active", true)
        .order("joined_at")
    : null;

  const membersResult = narrow ?? wide;
  const members = membersResult.data;
  const membersError = membersResult.error;

  if (membersError) {
    // Without this, a real query failure (RLS, a stale PostgREST schema
    // cache, a missing relationship) is indistinguishable from an empty
    // squad in every log — the UI already tells the coach something broke,
    // but nobody with server access could see *why*.
    reportError(membersError, { scope: "coach squad page", extra: { query: "team_members" } });
  }

  type SquadPlayerRow = {
    id: string; full_name: string; position: string | null;
    preferred_foot: string | null; date_of_birth: string | null;
    photo_url: string | null;
    player_ratings: { rating: number }[];
    player_attributes?: Partial<Record<AttrKey, number | null>>[] | null;
  };
  type MemberRow = {
    player_id: string;
    joined_at: string;
    players: SquadPlayerRow | SquadPlayerRow[] | null;
  };

  const basePlayers = ((members ?? []) as unknown as MemberRow[])
    .map((m) => {
      const p = Array.isArray(m.players) ? m.players[0] : m.players;
      return p ? { player: p, joinedAt: m.joined_at } : null;
    })
    .filter((x): x is { player: SquadPlayerRow; joinedAt: string } => x !== null);

  const playerIds = basePlayers.map((b) => b.player.id);
  const currentSeason = new Date().getFullYear().toString();
  const signedPhotoByUrl = await signPlayerPhotoUrls(supabase, basePlayers.map((b) => b.player.photo_url));

  // Training attendance and document compliance for the whole squad, in two
  // queries rather than one per player.
  //
  // Both of these already existed elsewhere — attendance drives the welfare
  // panel and the AI brief, documents drive the per-player badge — but the
  // coach actually picking Sunday's squad could see neither without opening
  // players one at a time.
  const since = attendanceWindowStart();
  const [{ data: sessions }, { data: docs }, availabilityResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, session_date")
      .eq("team_id", team.id)
      .gte("session_date", since)
      .order("session_date", { ascending: false }),
    playerIds.length
      ? supabase
          .from("player_documents")
          .select("player_id, status")
          .in("player_id", playerIds)
          .eq("season", currentSeason)
      : Promise.resolve({ data: [] as { player_id: string; status: string }[] }),
    // Tolerant of migration 039 not having run yet (42703) — same tradeoff
    // as squad-context.ts's own availability query.
    playerIds.length
      ? supabase.from("players").select("id, availability_status, availability_note").in("id", playerIds)
      : Promise.resolve({ data: [] as { id: string; availability_status: string; availability_note: string | null }[], error: null }),
  ]);

  // Minutes played this season (playing-time screen); empty until migration 062.
  const seasonMinutes = await loadSeasonMinutes(supabase, playerIds, currentSeason);

  const sessionIds = (sessions ?? []).map((x: { id: string }) => x.id);
  // Newest first, for counting each player's run of sessions in a row.
  const marksBySession = new Map<string, Map<string, AttendanceStatus>>();
  // Counted `status === "attending"` — migration 005's RSVP vocabulary, which
  // the app has never written. Shares one policy with the welfare page and
  // the AI brief now: late counts as attending, excused is left out.
  const marksByPlayer = new Map<string, AttendanceStatus[]>();
  if (sessionIds.length && playerIds.length) {
    const { data: att } = await supabase
      .from("training_attendance")
      .select("session_id, player_id, status")
      .in("session_id", sessionIds)
      .in("player_id", playerIds);
    for (const row of (att ?? []) as { session_id: string; player_id: string; status: string }[]) {
      if (!isAttendanceStatus(row.status)) continue;
      const register = marksBySession.get(row.session_id) ?? new Map<string, AttendanceStatus>();
      register.set(row.player_id, row.status);
      marksBySession.set(row.session_id, register);
      const list = marksByPlayer.get(row.player_id) ?? [];
      list.push(row.status);
      marksByPlayer.set(row.player_id, list);
    }
  }

  const docsByPlayer = new Map<string, number>();
  for (const d of (docs ?? []) as { player_id: string; status: string }[]) {
    if (d.status === "signed" || d.status === "uploaded") {
      docsByPlayer.set(d.player_id, (docsByPlayer.get(d.player_id) ?? 0) + 1);
    }
  }

  const availabilityByPlayer = new Map<string, { status: string; note: string | null }>();
  if (!isMissingAttributeColumn(availabilityResult.error)) {
    for (const row of (availabilityResult.data ?? []) as { id: string; availability_status: string; availability_note: string | null }[]) {
      if (row.availability_status !== "available") {
        availabilityByPlayer.set(row.id, { status: row.availability_status, note: row.availability_note });
      }
    }
  }

  // Readiness: load, attendance and rating trend in one flag per child. The
  // attendance figure is the one computed just above, not a second one.
  const readinessResult = await loadReadiness(
    supabase,
    team.id,
    team.age_group,
    playerIds.map((id) => {
      const pct = summariseAttendance(marksByPlayer.get(id) ?? []).pct;
      return { id, attendancePct: pct === null ? null : pct / 100 };
    }),
  );

  const squad = basePlayers.map(({ player: p, joinedAt }) => {
    const ratings = p.player_ratings.map((r) => r.rating);
    const avg = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;
    const age = calculateAge(p.date_of_birth);

    // Same Overall every other player surface shows: the mean of the
    // attributes this position is assessed on, averaged across coaches.
    const snapshot = buildAttributeSnapshot(p.player_attributes ?? null, p.position);

    const attendanceSummary = summariseAttendance(marksByPlayer.get(p.id) ?? []);
    const attendance = attendanceSummary.pct;
    const belowThreshold = attendanceSummary.belowThreshold;

    const docsSigned = docsByPlayer.get(p.id) ?? 0;
    const docsOutstanding = Math.max(0, REQUIRED_DOC_COUNT - docsSigned);
    const availability = availabilityByPlayer.get(p.id) ?? null;

    return {
      ...p,
      photo_url: (p.photo_url && signedPhotoByUrl.get(p.photo_url)) ?? null,
      avg,
      ratingsCount: ratings.length,
      age,
      joinedAt,
      overall: snapshot.overall,
      assessed: snapshot.assessedKeys.length > 0,
      attendance,
      belowThreshold,
      docsOutstanding,
      availability,
      readiness: readinessResult.byPlayer.get(p.id) ?? null,
      seasonMinutes: seasonMinutes.byPlayer.get(p.id)?.minutes ?? null,
      streak: attendanceStreak(p.id, sessionIds, marksBySession),
    };
  });

  // Below the attendance policy, or flagged by readiness for a check-in.
  const needsAWord = (p: (typeof squad)[number]) =>
    p.belowThreshold || (p.readiness !== null && p.readiness.level !== "steady");

  const matchesFilter = (p: (typeof squad)[number]) => {
    if (query && !p.full_name.toLowerCase().includes(query)) return false;
    if (filter === "attendance") return needsAWord(p);
    if (filter === "docs") return p.docsOutstanding > 0;
    if (filter === "injured") return p.availability !== null;
    if (filter === "unassessed") return !p.assessed;
    return true;
  };

  const visibleSquad = squad.filter(matchesFilter);
  const counts = {
    all: squad.length,
    attendance: squad.filter(needsAWord).length,
    docs: squad.filter((p) => p.docsOutstanding > 0).length,
    injured: squad.filter((p) => p.availability !== null).length,
    unassessed: squad.filter((p) => !p.assessed).length,
  };

  // Group by position group rather than the raw value. Players now carry
  // specific roles (cb, lb, cdm, …) as well as the five legacy ones, and
  // grouping on the raw value meant every specific role fell outside the
  // render order and simply never appeared.
  const byPosition: Record<string, typeof visibleSquad> = {};
  for (const p of visibleSquad) {
    const group = p?.position
      ? POSITIONS.find((x) => x.value === p.position)?.group ?? "Unassigned"
      : "Unassigned";
    if (!byPosition[group]) byPosition[group] = [];
    byPosition[group].push(p);
  }

  const posOrder = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unassigned"];
  const posHeading: Record<string, string> = {
    Goalkeeper: "Goalkeepers", Defender: "Defence", Midfielder: "Midfield", Forward: "Attack", Unassigned: "No position yet",
  };
  const toneClass = {
    clay: "bg-clay text-clay-foreground",
    sun: "bg-sun text-sun-foreground",
    neutral: "bg-muted text-muted-foreground",
  } as const;

  return (
    <div className="space-y-5">
      {/* Which team is being shown when a coach has more than one is the
          header's TeamSwitcher (dashboard-shell.tsx). The rarer tools sit
          behind More, so the page has one red action: Add player. */}
      <PageHeader
        title="Squad"
        description={
          <>
            {team.name}{team.age_group && !team.name.includes(team.age_group) && ` · ${team.age_group}`}
            {!membersError && ` · ${squad.length} ${squad.length === 1 ? "player" : "players"}`}
          </>
        }
        action={
          <div className="flex items-center gap-2">
            <SquadToolsMenu teamId={team.id} inviteCode={team.invite_code} />
            <Button asChild size="sm" className="shrink-0 pointer-coarse:h-11 pointer-coarse:px-4">
              <Link href={`/dashboard/coach/squad/add?team=${team.id}`}>
                <Plus className="size-4" aria-hidden="true" />
                Add player
              </Link>
            </Button>
          </div>
        }
      />

      {!membersError && squad.length > 0 && (
        <SquadFilters initialQuery={rawQuery} active={filter} counts={counts} />
      )}

      {membersError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Couldn&apos;t load this squad</CardTitle>
            <CardDescription>
              Something went wrong reading the player list — this isn&apos;t an empty
              squad. Try reloading; if it keeps happening, tell your admin.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : squad.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No players yet</CardTitle>
            <CardDescription>Add your first player, or copy the invite link from More so families can join.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/dashboard/coach/squad/add?team=${team.id}`}>
                <Plus className="size-4" aria-hidden="true" />
                Add player
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : visibleSquad.length === 0 ? (
        /* Distinct from "no players yet" on purpose — the squad is not
           empty, the search or filter just matched nobody. */
        <Card>
          <CardHeader>
            <CardTitle>No players match</CardTitle>
            <CardDescription>
              {query
                ? `Nobody in this squad matches "${rawQuery.trim()}".`
                : "No player in this squad matches that filter."}{" "}
              <Link href={`/dashboard/coach/squad?team=${team.id}`} className="text-primary hover:underline">
                Clear it
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-5">
          {visibleSquad.length < squad.length && (
            <ResultCount
              shown={visibleSquad.length}
              total={squad.length}
              noun={["player", "players"]}
              clearHref={`/dashboard/coach/squad?team=${team.id}`}
            />
          )}
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            {posOrder
              .filter((pos) => byPosition[pos]?.length)
              .map((pos) => (
                <section key={pos} aria-labelledby={`pos-${pos}`} className="space-y-2">
                  <h2 id={`pos-${pos}`} className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {posHeading[pos]} · {byPosition[pos].length}
                  </h2>
                  {/* One white card per position, a row per child: the name,
                      and the single thing worth knowing about them today
                      (lib/squad-status.ts). The full picture is one tap away. */}
                  <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-card">
                    {byPosition[pos].map((player) => {
                      const status = squadStatus({
                        ...player,
                        readinessLevel: player.readiness?.level ?? null,
                      });
                      const short = positionShort(player.position);
                      return (
                        <li key={player.id} className="group relative flex items-center">
                          <Link
                            href={`/dashboard/coach/squad/${player.id}?team=${team.id}`}
                            className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-hover"
                          >
                            <KitAvatar name={player.full_name} photoUrl={player.photo_url} />
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                              <span className="flex w-full min-w-0 items-baseline gap-1 text-[15px] font-semibold leading-tight">
                                <span className="truncate">{player.full_name}</span>
                                {short && <span className="shrink-0 font-medium text-muted-foreground">· {short}</span>}
                              </span>
                              <span className={cn("max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold", toneClass[status.tone])}>
                                {status.text}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 pointer-fine:group-hover:hidden" aria-hidden="true" />
                          </Link>
                          {/* Hover-only on a mouse; on touch, removing lives on the player's page. */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <RemovePlayerButton playerId={player.id} playerName={player.full_name} teamId={team.id} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
