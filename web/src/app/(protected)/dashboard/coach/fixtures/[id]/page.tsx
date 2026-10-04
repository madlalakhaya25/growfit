import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Printer, Star, Timer } from "lucide-react";
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
import { DeleteFixtureButton } from "./delete-fixture-button";
import { EditFixtureButton } from "./edit-fixture-button";
import { LogResultForm } from "./log/log-result-form";
import { MediaUploadForm } from "@/components/media/media-upload-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { MatchAttendanceForm } from "@/components/attendance/match-attendance-form";
import { MatchStoriesPanel, type StoryRow } from "@/components/fixtures/match-stories-panel";
import { loadFixtureStories } from "@/lib/family-messages";
import { MatchReportPanel } from "@/components/ai/match-report-panel";
import { fixtureStatusLabel, fixtureStatusVariant, isFixturePast, type FixtureBadgeVariant } from "@/lib/fixtures";
import { signPlayerPhotoUrls } from "@/lib/player-photo";
import { formatInTimezone } from "@/lib/time";
import { cleanPhaseRatings, phaseHighlights, ratedPhases } from "@/lib/match-phases";
import { QueryTabs } from "@/components/ui/query-tabs";
import { pickTab } from "@/lib/tabs";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "squad", label: "Squad" },
  { id: "report", label: "Report" },
] as const;

// A tab that isn't open loads nothing for its data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NONE = Promise.resolve({ data: [] as any[] });
const NO_PROFILE = Promise.resolve({ data: null as { academy_id: string | null } | null });

/**
 * The status badge on the matchday header uses Badge's `onInk` variant (a
 * single ink-safe pill, see badge.tsx's own note) plus one of these small
 * solid dots for the actual status colour — a dot is opaque, so it reads
 * fine on the inverted ink band in both themes without needing an
 * "-on-ink" pair for every status colour the way text would.
 */
const STATUS_DOT: Record<FixtureBadgeVariant, string> = {
  neutral: "bg-ink-foreground/50",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-destructive",
};

export default async function FixtureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const tab = pickTab(TABS, tabParam);
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

  const onOverview = tab === "overview";
  const onSquad = tab === "squad";
  const onReport = tab === "report";
  // The log-result form (overview, once kickoff has passed) needs the squad too.
  const logFormOpen = onOverview && fixture.status === "upcoming" && isFixturePast(fixture);
  const needsSquad = onSquad || logFormOpen;

  const [
    { data: media },
    { data: squadMembersRaw },
    { data: profile },
    { data: matchAttendanceRaw },
  ] = await Promise.all([
    onReport
      ? supabase
          .from("media_uploads")
          .select("id, url, media_type, caption, created_at, uploaded_by, media_tags ( player_id, players ( full_name ) )")
          .eq("fixture_id", id)
          .order("created_at", { ascending: false })
      : NONE,
    fixture.team_id && (needsSquad || onReport)
      ? supabase
          .from("team_members")
          .select("players ( id, full_name, position )")
          .eq("team_id", fixture.team_id)
          .eq("active", true)
      : NONE,
    onReport
      ? supabase
          .from("profiles")
          .select("academy_id")
          .eq("id", user.id)
          .single()
      : NO_PROFILE,
    onSquad
      ? supabase
          .from("match_attendance")
          .select("player_id, status")
          .eq("fixture_id", id)
      : NONE,
  ]);

  type Appearance = { played: boolean; players: { id: string; full_name: string; position: string | null; photo_url: string | null } | { id: string; full_name: string; position: string | null; photo_url: string | null }[] | null };
  type PRating = { rating: number; note: string | null; players: { id: string; full_name: string } | { id: string; full_name: string }[] | null };

  const result = Array.isArray(fixture.match_results) ? fixture.match_results[0] : fixture.match_results;
  const appearances: Appearance[] = fixture.match_appearances ?? [];
  const ratings: PRating[] = fixture.player_ratings ?? [];
  const date = new Date(fixture.fixture_date);

  const signedPhotoByUrl = await signPlayerPhotoUrls(
    supabase,
    (onOverview ? appearances : []).map((a) => (Array.isArray(a.players) ? a.players[0] : a.players)?.photo_url ?? null)
  );

  const stories = onReport ? await loadFixtureStories(supabase, id) : { available: false, byPlayer: new Map<string, never>() };
  const storyRows: StoryRow[] = appearances.flatMap((a) => {
    const p = Array.isArray(a.players) ? a.players[0] : a.players;
    if (!p) return [];
    const m = stories.byPlayer.get(p.id);
    return [{ playerId: p.id, name: p.full_name, message: m ? { id: m.id, body: m.body, status: m.status, approvedByName: m.approvedByName } : null }];
  });

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

  const attendanceByPlayer = fixture.team_id && logFormOpen
    ? await getTrainingAttendanceSummaries(supabase, fixture.team_id, flattenedSquadPlayers.map((p) => p.id))
    : new Map<string, AttendanceSummary>();
  const trainingAttendance: Record<string, AttendanceSummary> = Object.fromEntries(attendanceByPlayer);

  // Queried separately, and tolerant of migration 039 not having run yet
  // (42703) — see squad-context.ts's own note on the same tradeoff.
  const playerAvailability: Record<string, { status: string; note: string | null }> = {};
  if (logFormOpen && flattenedSquadPlayers.length > 0) {
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

  // Phase-of-play ratings live on match_results from migration 061; read on
  // their own so a database without the column still shows the fixture.
  let phases: ReturnType<typeof ratedPhases> = [];
  let phaseSummary: ReturnType<typeof phaseHighlights> = null;
  if (onOverview && result) {
    const { data: phaseRow, error: phaseError } = await supabase
      .from("match_results")
      .select("phase_ratings")
      .eq("fixture_id", id)
      .maybeSingle();
    if (!phaseError) {
      const cleaned = cleanPhaseRatings((phaseRow as { phase_ratings?: unknown } | null)?.phase_ratings);
      phases = ratedPhases(cleaned);
      phaseSummary = phaseHighlights(cleaned);
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

      {/* Matchday header — a score panel that uses the same card surface as the
          log-result form so it stays readable and consistent in both themes,
          while keeping the fixture actions aligned with the same neutral card
          styling instead of the old pitch-band treatment. */}
      <div className="rounded-xl border border-border bg-card px-5 py-6 text-card-foreground shadow-sm">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatInTimezone(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {fixture.venue && ` · ${fixture.venue}`}
        </p>
        <p className="mt-2 flex items-center justify-center gap-3 font-display text-2xl sm:text-3xl">
          <span>Growfit</span>
          {result ? (
            <span className="tabular-nums" aria-label={`${result.team_score} to ${result.opponent_score}`}>
              {result.team_score}
              <span className="mx-1.5 text-muted-foreground/70">–</span>
              {result.opponent_score}
            </span>
          ) : (
            <span className="text-base font-sans font-medium text-muted-foreground">{fixture.is_home ? "vs" : "@"}</span>
          )}
          <span>{fixture.opponent}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="neutral" className="capitalize border-border bg-secondary text-secondary-foreground">
            <span className={`size-1.5 rounded-full ${STATUS_DOT[fixtureStatusVariant(fixture)]}`} aria-hidden="true" />
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
          {/* Delete has no cancellation-notice trail, so it's offered
              whenever there's nothing historical to lose — same boundary
              deleteFixture() itself enforces — rather than only pre-kickoff,
              so a coach can also clean up a cancelled or wrongly-dated
              entry instead of it sitting there forever. */}
          {fixture.status !== "completed" && (
            <DeleteFixtureButton fixtureId={id} />
          )}
          {fixture.status !== "cancelled" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/coach/fixtures/${id}/minutes`}>
                <Timer className="size-4" aria-hidden="true" />
                Playing time
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/print/match/${id}`} target="_blank" rel="noopener">
              <Printer className="size-4" aria-hidden="true" />
              {fixture.status === "completed" ? "Match report" : "Team sheet"}
            </Link>
          </Button>
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

      <QueryTabs tabs={TABS} active={tab} basePath={`/dashboard/coach/fixtures/${id}`} />

      {onOverview && (
        <>
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

      {phases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Phases of play</h2>
          <Card className="p-4 space-y-3">
            <ul className="space-y-2">
              {phases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{p.label}</span>
                  <span className="flex shrink-0 gap-0.5" aria-label={`${p.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`size-3.5 ${n <= p.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            {phaseSummary && (
              <p className="text-xs text-muted-foreground">
                Strongest: {phaseSummary.best}. Work on: {phaseSummary.worst}.
              </p>
            )}
          </Card>
        </section>
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
                    leading={<PlayerAvatar name={player.full_name} photoUrl={player.photo_url ? signedPhotoByUrl.get(player.photo_url) ?? null : null} size="sm" />}
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

        </>
      )}

      {onSquad && (
        <>
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

        </>
      )}

      {onReport && (
        <>
      {/* Stories for each child's family, shared only after the coach approves. */}
      {fixture.status === "completed" && appearances.length > 0 && (
        <section className="max-w-2xl">
          <MatchStoriesPanel
            key={storyRows.map((r) => `${r.message?.id}${r.message?.status}`).join()}
            fixtureId={id}
            rows={storyRows}
            available={stories.available}
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
        </>
      )}
    </div>
  );
}
