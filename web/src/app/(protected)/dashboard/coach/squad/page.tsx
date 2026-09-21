import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Upload, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RemovePlayerButton } from "./remove-player-button";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { POSITIONS } from "@/lib/types";
import { calculateAge, getInitials } from "@/lib/player";
import { cn } from "@/lib/utils";
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
import { reportError } from "@/lib/report-error";

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
    rawFilter === "attendance" || rawFilter === "docs" || rawFilter === "unassessed"
      ? rawFilter
      : "all";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, age_group, invite_code")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = allTeams.find((t: { id: string; name: string; age_group: string | null; invite_code: string }) => t.id === teamParam) ?? allTeams[0];

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

  // Training attendance and document compliance for the whole squad, in two
  // queries rather than one per player.
  //
  // Both of these already existed elsewhere — attendance drives the welfare
  // panel and the AI brief, documents drive the per-player badge — but the
  // coach actually picking Sunday's squad could see neither without opening
  // players one at a time.
  const since = attendanceWindowStart();
  const [{ data: sessions }, { data: docs }] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id")
      .eq("team_id", team.id)
      .gte("session_date", since),
    playerIds.length
      ? supabase
          .from("player_documents")
          .select("player_id, status")
          .in("player_id", playerIds)
          .eq("season", currentSeason)
      : Promise.resolve({ data: [] as { player_id: string; status: string }[] }),
  ]);

  const sessionIds = (sessions ?? []).map((x: { id: string }) => x.id);
  // Counted `status === "attending"` — migration 005's RSVP vocabulary, which
  // the app has never written. Shares one policy with the welfare page and
  // the AI brief now: late counts as attending, excused is left out.
  const marksByPlayer = new Map<string, AttendanceStatus[]>();
  if (sessionIds.length && playerIds.length) {
    const { data: att } = await supabase
      .from("training_attendance")
      .select("player_id, status")
      .in("session_id", sessionIds)
      .in("player_id", playerIds);
    for (const row of (att ?? []) as { player_id: string; status: string }[]) {
      if (!isAttendanceStatus(row.status)) continue;
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

    return {
      ...p,
      avg,
      ratingsCount: ratings.length,
      age,
      joinedAt,
      overall: snapshot.overall,
      assessed: snapshot.assessedKeys.length > 0,
      attendance,
      belowThreshold,
      docsOutstanding,
    };
  });

  const matchesFilter = (p: (typeof squad)[number]) => {
    if (query && !p.full_name.toLowerCase().includes(query)) return false;
    if (filter === "attendance") return p.belowThreshold;
    if (filter === "docs") return p.docsOutstanding > 0;
    if (filter === "unassessed") return !p.assessed;
    return true;
  };

  const visibleSquad = squad.filter(matchesFilter);
  const counts = {
    all: squad.length,
    attendance: squad.filter((p) => p.belowThreshold).length,
    docs: squad.filter((p) => p.docsOutstanding > 0).length,
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

  return (
    <div className="space-y-6">
      {allTeams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allTeams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/coach/squad?team=${t.id}`}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
                t.id === team.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {t.name} {t.age_group && `· ${t.age_group}`}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Squad</h1>
          <p className="text-sm text-muted-foreground">
            {team.name}{team.age_group && ` · ${team.age_group}`}
            {!membersError && ` · ${squad.length} ${squad.length === 1 ? "player" : "players"}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <CopyInviteLinkButton inviteCode={team.invite_code} />
          <Button asChild variant="outline" className="shrink-0">
            <Link href={`/dashboard/coach/squad/import?team=${team.id}`}>
              <Upload className="size-4" aria-hidden="true" />
              Import
            </Link>
          </Button>
          <Button asChild className="shrink-0">
            <Link href={`/dashboard/coach/squad/add?team=${team.id}`}>
              <Plus className="size-4" aria-hidden="true" />
              Add player
            </Link>
          </Button>
        </div>
      </div>

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
            <CardDescription>Add your first player to get started.</CardDescription>
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
        <div className="space-y-8">
          {posOrder
            .filter((pos) => byPosition[pos]?.length)
            .map((pos) => (
              <section key={pos}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {pos} · {byPosition[pos].length}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {byPosition[pos].map((player) => {
                    if (!player) return null;
                    const initials = getInitials(player.full_name);
                    return (
                      <div
                        key={player.id}
                        className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                      >
                        {/* Avatar */}
                        <Link href={`/dashboard/coach/squad/${player.id}?team=${team.id}`} className="flex-shrink-0">
                          {player.photo_url ? (
                            <Image
                              src={player.photo_url}
                              alt={player.full_name}
                              width={48}
                              height={48}
                              className="size-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="grid size-12 place-items-center rounded-full bg-brand/20 text-sm font-bold text-primary">
                              {initials}
                            </span>
                          )}
                        </Link>

                        {/* Info.
                            The card used to carry the match-rating average
                            and nothing else — not the attribute Overall
                            every other surface shows, not attendance, not
                            document status. All three were already computed
                            elsewhere in the app; this is the screen where
                            they actually change a decision. */}
                        <Link href={`/dashboard/coach/squad/${player.id}?team=${team.id}`} className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate font-semibold leading-tight">{player.full_name}</p>
                            {player.overall !== null && (
                              <span className="shrink-0 text-sm font-bold tabular-nums">{player.overall}</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {player.age && (
                              <Badge variant="neutral" className="text-xs">Age {player.age}</Badge>
                            )}
                            {player.preferred_foot && (
                              <Badge variant="neutral" className="text-xs capitalize">
                                {player.preferred_foot}
                              </Badge>
                            )}
                            {/* Only ever flagged when it needs action — red
                                that always shows stops meaning anything. */}
                            {player.belowThreshold && (
                              <Badge variant="danger" className="text-xs">
                                {player.attendance}% attendance
                              </Badge>
                            )}
                            {player.docsOutstanding > 0 && (
                              <Badge variant="warning" className="text-xs">
                                {player.docsOutstanding} doc{player.docsOutstanding === 1 ? "" : "s"} due
                              </Badge>
                            )}
                            {!player.assessed && (
                              <Badge variant="neutral" className="text-xs">Not assessed</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {player.avg ? `★ ${player.avg} avg · ${player.ratingsCount}` : "No match ratings"}
                            {player.attendance !== null && !player.belowThreshold
                              ? ` · ${player.attendance}% training`
                              : ""}
                          </p>
                        </Link>

                        {/* Remove */}
                        <RemovePlayerButton playerId={player.id} playerName={player.full_name} teamId={team.id} />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
