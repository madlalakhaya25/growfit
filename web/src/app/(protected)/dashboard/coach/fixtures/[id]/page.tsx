import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelFixtureButton } from "./cancel-fixture-button";
import { LogResultForm } from "./log/log-result-form";
import { MediaUploadForm } from "@/components/media/media-upload-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { MatchAttendanceForm } from "@/components/attendance/match-attendance-form";
import { MatchReportPanel } from "@/components/ai/match-report-panel";
import { fixtureStatusLabel, fixtureStatusVariant } from "@/lib/fixtures";
import { getInitials } from "@/lib/player";

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
      .select("id, url, media_type, caption, created_at, media_tags ( player_id, players ( full_name ) )")
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
    media_tags: RawMediaTag[] | null;
  };
  const normalizedMediaItems = (media ?? []).map((item: RawMediaItem) => ({
    id: item.id,
    url: item.url,
    media_type: item.media_type,
    caption: item.caption,
    created_at: item.created_at,
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

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {fixture.is_home ? "vs" : "@"} {fixture.opponent}
          </h1>
          <p className="text-muted-foreground">
            {date.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {fixture.venue && ` · ${fixture.venue}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={fixtureStatusVariant(fixture)} className="capitalize">
            {fixtureStatusLabel(fixture)}
          </Badge>
          {fixture.status === "upcoming" && (
            <CancelFixtureButton fixtureId={id} />
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

      {/* Inline log result form */}
      {fixture.status === "upcoming" && (
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
          />
        </section>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {fixture.is_home ? "Us" : fixture.opponent}
                </p>
                <p className="text-5xl font-black tabular-nums">{fixture.is_home ? result.team_score : result.opponent_score}</p>
              </div>
              <span className="text-2xl text-muted-foreground font-light">—</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {fixture.is_home ? fixture.opponent : "Us"}
                </p>
                <p className="text-5xl font-black tabular-nums">{fixture.is_home ? result.opponent_score : result.team_score}</p>
              </div>
            </div>
            {result.match_notes && (
              <p className="mt-4 text-center text-sm text-muted-foreground">{result.match_notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appearances + Ratings */}
      {appearances.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Squad appearances</h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {appearances.map((a, i) => {
              const player = Array.isArray(a.players) ? a.players[0] : a.players;
              if (!player) return null;
              const rating = ratingsMap.get(player.id);
              const initials = getInitials(player.full_name);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-primary">
                    {initials}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{player.full_name}</p>
                  </div>
                  {rating && (
                    <div className="flex shrink-0 gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} className={`size-3.5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} aria-hidden="true" />
                      ))}
                    </div>
                  )}
                  <Badge variant={a.played ? "success" : "neutral"} className="shrink-0">
                    {a.played ? "Played" : "Absent"}
                  </Badge>
                </div>
              );
            })}
          </div>
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
          <MediaGallery items={normalizedMediaItems} />
        ) : (
          <p className="text-sm text-muted-foreground">No media yet — upload match photos or videos.</p>
        )}
      </section>
    </div>
  );
}
