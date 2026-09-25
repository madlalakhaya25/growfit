import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTrainingAttendanceSummaries } from "@/lib/training-attendance";
import type { AttendanceSummary } from "@/lib/attendance";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { CancelFixtureButton } from "./cancel-fixture-button";
import { EditFixtureButton } from "./edit-fixture-button";
import { LogResultForm } from "./log/log-result-form";
import { MediaUploadForm } from "@/components/media/media-upload-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { MatchAttendanceForm } from "@/components/attendance/match-attendance-form";
import { MatchReportPanel } from "@/components/ai/match-report-panel";
import { fixtureStatusLabel, fixtureStatusVariant, isFixturePast } from "@/lib/fixtures";
import { formatInTimezone } from "@/lib/time";

export default async function FixtureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: fixture } = await supabase
    .from("fixtures")
    .select(`
      id, opponent, venue, fixture_date, is_home, status, notes, cancellation_reason, team_id,
      match_results ( team_score, opponent_score, match_notes ),
      match_appearances (
        played,
        players ( id, full_name, position, photo_url )
      ),
      player_ratings (
        rating, note,
        players ( id, full_name )
      )
    `)
    .eq("id", id)
    .single();

  if (!fixture) notFound();

  const [
    { data: media },
    { data: squadMembersRaw },
    { data: profile },
    { data: matchAttendanceRaw },
  ] = await Promise.all([
    supabase
      .from("media_uploads")
      .select("id, url, media_type, caption, created_at, uploaded_by, media_tags ( player_id, players ( full_name ) )")
      .eq("fixture_id", id)
      .order("created_at", { ascending: false }),
    fixture.team_id
      ? supabase
          .from("team_members")
          .select("players ( id, full_name, position )")
          .eq("team_id", fixture.team_id)
          .eq("active", true)
      : Promise.resolve({ data: [] }),
    supabase
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("match_attendance")
      .select("player_id, status")
      .eq("fixture_id", id),
  ]);

  type Appearance = { played: boolean; players: { id: string; full_name: string; position: string | null; photo_url: string | null } | { id: string; full_name: string; position: string | null; photo_url: string | null }[] | null };
  type PRating = { rating: number; note: string | null; players: { id: string; full_name: string } | { id: string; full_name: string }[] | null };

  const result = Array.isArray(fixture.match_results) ? fixture.match_results[0] : fixture.match_results;
  const appearances: Appearance[] = fixture.match_appearances ?? [];
  const ratings: PRating[] = fixture.player_ratings ?? [];
  const date = new Date(fixture.fixture_date);

  const ratingsMap = new Map(ratings.map((r) => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    return [p?.id, r.rating];
  }));

  // Flatten squad players from nested join
  type SquadPlayerRow = { id: string; full_name: string; position: string | null };
  type SquadMemberRaw = { players: SquadPlayerRow | SquadPlayerRow[] | null };
  const flattenedSquadPlayers: SquadPlayerRow[] = (squadMembersRaw ?? []).flatMap((m: SquadMemberRaw) => {
    if (!m.players) return [];
    return Array.isArray(m.players) ? m.players : [m.players];
  });

  const attendanceByPlayer = fixture.team_id
    ? await getTrainingAttendanceSummaries(supabase, fixture.team_id, flattenedSquadPlayers.map((p) => p.id))
    : new Map<string, AttendanceSummary>();
  const trainingAttendance: Record<string, AttendanceSummary> = Object.fromEntries(attendanceByPlayer);

  // Queried separately, and tolerant of migration 039 not having run yet
  // (42703) — see squad-context.ts's own note on the same tradeoff.
  const playerAvailability: Record<string, { status: string; note: string | null }> = {};
  if (flattenedSquadPlayers.length > 0) {
    const availabilityResult = await supabase
      .from("players")
      .select("id, availability_status, availability_note")
      .in("id", flattenedSquadPlayers.map((p) => p.id));
    if (!isMissingAttributeColumn(availabilityResult.error)) {
      for (const row of (availabilityResult.data ?? []) as { id: string; availability_status: string; availability_note: string | null }[]) {
        if (row.availability_status !== "available") {
          playerAvailability[row.id] = { status: row.availability_status, note: row.availability_note };
        }
      }
    }
  }

  type MatchAttendanceRecord = { player_id: string; status: "present" | "absent" | "late" | "excused" };
  const existingAttendance: MatchAttendanceRecord[] = (matchAttendanceRaw ?? []) as MatchAttendanceRecord[];

  // Normalize media items
  type RawMediaTag = { player_id: string; players: { full_name: string } | { full_name: string }[] | null };
  type RawMediaItem = {
    id: string;
    url: string;
    media_type: string;
    caption: string | null;
    created_at: string;
    uploaded_by: string | null;
    media_tags: RawMediaTag[] | null;
  };
  const normalizedMediaItems = (media ?? []).map((item: RawMediaItem) => ({
    id: item.id,
    url: item.url,
    media_type: item.media_type,
    caption: item.caption,
    created_at: item.created_at,
    uploaded_by: item.uploaded_by,
    tagged_players: (item.media_tags ?? []).flatMap((tag: RawMediaTag) => {
      if (!tag.players) return [];
      return Array.isArray(tag.players) ? tag.players : [tag.players];
    }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/coach/fixtures">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Fixtures
          </Link>
        </Button>
      </div>

      {/* Matchday header — an ink band with the scoreline (or "vs" for an
          upcoming fixture), replacing the plain h1/badge row. */}
      <div className="rounded-lg bg-ink px-5 py-6 text-ink-foreground pitch-lines">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-white/60">
          {formatInTimezone(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {fixture.venue && ` · ${fixture.venue}`}
        </p>
        <p className="mt-2 flex items-center justify-center gap-3 font-display text-2xl sm:text-3xl">
          <span>Growfit</span>
          {result ? (
            <span className="tabular-nums" aria-label={`${result.team_score} to ${result.opponent_score}`}>
              {result.team_score}
              <span className="mx-1.5 text-white/50">–</span>
              {result.opponent_score}
            </span>
          ) : (
            <span className="text-base font-sans font-medium text-white/70">{fixture.is_home ? "vs" : "@"}</span>
          )}
          <span>{fixture.opponent}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant={fixtureStatusVariant(fixture)} className="capitalize">
            {fixtureStatusLabel(fixture)}
          </Badge>
          {!isFixturePast(fixture) && (
            <>
              <EditFixtureButton
                fixtureId={id}
                fixture={{
                  opponent: fixture.opponent,
                  venue: fixture.venue,
                  fixture_date: fixture.fixture_date,
                  is_home: fixture.is_home,
                  notes: fixture.notes,
                }}
              />
              <CancelFixtureButton fixtureId={id} />
            </>
          )}
        </div>
      </div>

      {fixture.status === "cancelled" && fixture.cancellation_reason && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="font-medium">Cancelled: </span>
          {fixture.cancellation_reason}
        </p>
      )}

      {fixture.notes && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {fixture.notes}
        </p>
      )}

      {/* Inline log result form — only once kickoff has actually passed
          (isFixturePast), not just because the status column still says
          "upcoming"; it can say that for days after the final whistle
          since nothing flips it automatically. */}
      {fixture.status === "upcoming" && isFixturePast(fixture) && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Log result</h2>
          </div>
          <LogResultForm
            fixtureId={id}
            squad={flattenedSquadPlayers}
            isHome={fixture.is_home}
            opponent={fixture.opponent}
            hideCancel
            trainingAttendance={trainingAttendance}
            playerAvailability={playerAvailability}
          />
        </section>
      )}

      {result?.match_notes && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          {result.match_notes}
        </p>
      )}

      {/* Appearances + Ratings */}
      {appearances.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Squad appearances</h2>
          <Card>
            <ListRowGroup className="px-4">
              {appearances.map((a, i) => {
                const player = Array.isArray(a.players) ? a.players[0] : a.players;
                if (!player) return null;
                const rating = ratingsMap.get(player.id);
                return (
                  <ListRow
                    key={i}
                    leading={<PlayerAvatar name={player.full_name} photoUrl={player.photo_url} size="sm" />}
                    title={player.full_name}
                    trailing={
                      <div className="flex items-center gap-2">
                        {rating && (
                          <div className="flex shrink-0 gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`size-3.5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        )}
                        <Badge variant={a.played ? "success" : "neutral"} className="shrink-0">
                          {a.played ? "Played" : "Absent"}
                        </Badge>
                      </div>
                    }
                  />
                );
              })}
            </ListRowGroup>
          </Card>
        </div>
      )}

      {/* Attendance */}
      {flattenedSquadPlayers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Attendance</h2>
          <MatchAttendanceForm
            fixtureId={id}
            players={flattenedSquadPlayers}
            existing={existingAttendance}
          />
        </section>
      )}

      {/* AI Match Report */}
      {fixture.status === "completed" && (
        <section className="space-y-3 max-w-2xl">
          <MatchReportPanel fixtureId={id} />
        </section>
      )}

      {/* Photos & Videos */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Photos &amp; Videos</h2>
          <MediaUploadForm
            teamId={fixture.team_id ?? ""}
            fixtureId={id}
            academyId={profile?.academy_id ?? ""}
            squadPlayers={flattenedSquadPlayers}
          />
        </div>
        {normalizedMediaItems.length > 0 ? (
          <MediaGallery
            items={normalizedMediaItems}
            canDelete
            currentUserId={user?.id}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No media yet — upload match photos or videos.</p>
        )}
      </section>
    </div>
  );
}
