import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Star, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { POSITIONS, FEET } from "@/lib/types";
import { isFixturePast, fixtureStatusLabel, fixtureStatusVariant } from "@/lib/fixtures";
import { calculateAge } from "@/lib/player";
import { RemovePlayerPhotoButton } from "@/components/remove-player-photo-button";
import { MedicalForm } from "@/components/records/medical-form";
import { DocumentHub } from "@/components/records/document-hub";
import { ParentReportPanel } from "@/components/ai/parent-report-panel";
import { AttributeSummary } from "@/components/player/attribute-summary";
import { PlayerPassportCard } from "@/components/player/player-passport-card";
import {
  ALL_ATTR_SELECT,
  averageAttributeRows,
  calculateOverall,
  type AttrKey,
} from "@/lib/attributes";
import { matchRatingAverage } from "@/lib/player";

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: link } = await supabase
    .from("parent_player_links")
    .select("player_id")
    .eq("parent_id", user.id)
    .eq("player_id", childId)
    .single();

  if (!link) notFound();

  const currentSeason = new Date().getFullYear().toString();

  const [{ data: player }, { data: attrRows }, { data: memberRows }, { data: medical }, { data: docs }] = await Promise.all([
    supabase
      .from("players")
      .select(`
        id, full_name, position, secondary_pos, preferred_foot, date_of_birth, photo_url, share_token,
        player_ratings (
          id, rating, note, created_at,
          fixtures ( opponent, fixture_date )
        )
      `)
      .eq("id", childId)
      .single(),
    supabase
      .from("player_attributes")
      .select(ALL_ATTR_SELECT)
      .eq("player_id", childId),
    supabase
      .from("team_members")
      .select("team_id, teams ( name, age_group )")
      .eq("player_id", childId)
      .eq("active", true),
    supabase.from("player_medical").select("*").eq("player_id", childId).maybeSingle(),
    supabase.from("player_documents").select("document_type, status, signer_name, signed_at, uploaded_at, upload_url").eq("player_id", childId).eq("season", currentSeason),
  ]);

  if (!player) notFound();

  type Rating = {
    id: string;
    rating: number;
    note: string | null;
    created_at: string;
    fixtures: { opponent: string; fixture_date: string } | { opponent: string; fixture_date: string }[] | null;
  };
  const ratings: Rating[] = player.player_ratings ?? [];

  // Averaged across every coach who assessed this child, then narrowed to the
  // attributes their position is actually assessed on. This page used to
  // average a fixed six columns, so a parent saw a different Overall for their
  // own child than the coach did.
  const attrs = averageAttributeRows(
    attrRows as Partial<Record<AttrKey, number | null>>[] | null
  );
  const matchAvg = matchRatingAverage(ratings.map((r) => r.rating));
  const overall = calculateOverall(attrs, player.position) ?? matchAvg;

  const teamIds = (memberRows ?? []).map((m: { team_id: string }) => m.team_id);
  const teamMap = new Map(
    (memberRows ?? []).map((m: { team_id: string; teams: { name: string; age_group: string | null } | { name: string; age_group: string | null }[] | null }) => [
      m.team_id,
      Array.isArray(m.teams) ? m.teams[0] : m.teams,
    ])
  );

  const [{ data: fixtures }, { data: appearances }, { data: matchAttendanceRows }] = await Promise.all([
    teamIds.length
      ? supabase
          .from("fixtures")
          .select(`id, team_id, opponent, venue, fixture_date, is_home, status, cancellation_reason, match_results ( team_score, opponent_score )`)
          .in("team_id", teamIds)
          .order("fixture_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("match_appearances")
      .select("fixture_id, played")
      .eq("player_id", childId),
    supabase
      .from("match_attendance")
      .select("fixture_id, status")
      .eq("player_id", childId),
  ]);

  const appearanceMap = new Map(
    (appearances ?? []).map((a: { fixture_id: string; played: boolean }) => [a.fixture_id, a])
  );

  type AttendanceStatus = "present" | "absent" | "late" | "excused";
  const matchAttendanceMap = new Map<string, AttendanceStatus>(
    (matchAttendanceRows ?? []).map((r: { fixture_id: string; status: AttendanceStatus }) => [r.fixture_id, r.status] as [string, AttendanceStatus])
  );

  const allFixtures = fixtures ?? [];
  const upcoming = allFixtures.filter((f) => !isFixturePast(f));
  const past = allFixtures.filter((f) => isFixturePast(f));

  const posLabel = POSITIONS.find((p) => p.value === player.position)?.label ?? "—";
  const footLabel = FEET.find((f) => f.value === player.preferred_foot)?.label;
  const age = calculateAge(player.date_of_birth);

  type Fixture = (typeof allFixtures)[number];

  const ATTENDANCE_VARIANT: Record<AttendanceStatus, "success" | "neutral" | "warning" | "brand"> = {
    present: "success",
    absent: "neutral",
    late: "warning",
    excused: "brand",
  };

  function FixtureRow({ f }: { f: Fixture }) {
    const date = new Date(f.fixture_date);
    const result = Array.isArray(f.match_results) ? f.match_results[0] : f.match_results;
    const appearance = appearanceMap.get(f.id);
    const attendanceStatus = matchAttendanceMap.get(f.id);
    const teamInfo = teamMap.get(f.team_id) as { name: string; age_group: string | null } | null | undefined;
    return (
      <ListRow
        title={`${f.is_home ? "vs" : "@"} ${f.opponent}`}
        subtitle={
          <>
            {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
            {f.venue && ` · ${f.venue}`}
            {teamIds.length > 1 && teamInfo && ` · ${teamInfo.name}`}
            {f.status === "cancelled" && f.cancellation_reason && (
              <span className="text-destructive"> · Cancelled: {f.cancellation_reason}</span>
            )}
          </>
        }
        trailing={
          <div className="flex items-center gap-2">
            {result && (
              <span className="font-bold tabular-nums text-sm text-foreground">
                {f.is_home ? result.team_score : result.opponent_score}
                {" – "}
                {f.is_home ? result.opponent_score : result.team_score}
              </span>
            )}
            {attendanceStatus ? (
              <Badge variant={ATTENDANCE_VARIANT[attendanceStatus]} className="capitalize">
                {attendanceStatus}
              </Badge>
            ) : appearance ? (
              <Badge variant={appearance.played ? "success" : "neutral"}>
                {appearance.played ? "Played" : "Absent"}
              </Badge>
            ) : null}
            {/* A logged score already says "completed" — the status badge
                only earns its place for the cases a score doesn't cover
                (upcoming, cancelled, postponed, or completed with no
                score logged yet). Showing "Completed" next to a 2–1 was
                the third badge crowding this row on a phone. */}
            {!result && (
              <Badge variant={fixtureStatusVariant(f)} className="capitalize">
                {fixtureStatusLabel(f)}
              </Badge>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <Link
            href="/dashboard/parent"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            My Children
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/40" aria-hidden="true" />
          <span className="font-medium truncate max-w-[180px] sm:max-w-none">{player.full_name}</span>
        </nav>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "#ratings", label: "Ratings" },
            { href: "#fixtures", label: "Fixtures" },
            { href: "#documents", label: "Documents" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Passport card */}
        <PlayerPassportCard
          contentClassName="space-y-4"
          photoUrl={player.photo_url}
          fullName={player.full_name}
          overall={overall}
          posLabel={posLabel}
          headerExtra={
            player.photo_url && (
              <div className="pt-1">
                <RemovePlayerPhotoButton playerId={player.id} />
              </div>
            )
          }
          badges={
            <>
              <Badge variant="brand">{posLabel}</Badge>
              {age && <Badge variant="neutral">Age {age}</Badge>}
              {footLabel && <Badge variant="neutral">{footLabel} foot</Badge>}
            </>
          }
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Ratings</p>
              <p className="font-semibold">{ratings.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Public passport link</p>
              {/* The parent view showed the bare token as text with no link
                  — the only one of the five surfaces that did. */}
              <Link
                href={`/passport/${player.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-semibold tracking-wide text-primary hover:underline"
              >
                {player.share_token} ↗
              </Link>
            </div>
          </div>
          <AttributeSummary
            attrs={attrs}
            position={player.position}
            className="space-y-2 border-t border-border pt-3"
          />
          <a
            href={`/print/term-report/${player.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            Term report
          </a>
        </PlayerPassportCard>

        {/* Ratings + Fixtures */}
        <div className="space-y-6 lg:col-span-2">
          {/* Rating history */}
          <section id="ratings" className="space-y-3">
            <h2 className="text-lg font-semibold">Rating history</h2>
            {ratings.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">No ratings yet</CardTitle>
                  <CardDescription>Ratings appear after the coach logs match results.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <Card>
                <ListRowGroup className="px-4">
                  {[...ratings]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((r) => {
                      const fixture = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
                      return (
                        <ListRow
                          key={r.id}
                          leading={
                            <div className="flex shrink-0 gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`size-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                          }
                          title={fixture ? `vs ${fixture.opponent}` : "Standalone assessment"}
                          subtitle={r.note ? `“${r.note}”` : undefined}
                          trailing={new Date(r.created_at).toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                          })}
                        />
                      );
                    })}
                </ListRowGroup>
              </Card>
            )}
          </section>

          {/* Fixtures */}
          <section id="fixtures" className="space-y-3">
            <h2 className="text-lg font-semibold">Fixtures</h2>
            {!teamIds.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Not in a team yet</CardTitle>
                  <CardDescription>Fixtures will appear once the coach adds your child to a team.</CardDescription>
                </CardHeader>
              </Card>
            ) : allFixtures.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">No fixtures yet</CardTitle>
                  <CardDescription>Upcoming matches will appear here once scheduled.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcoming.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Upcoming
                    </p>
                    <Card>
                      <ListRowGroup className="px-4">
                        {upcoming.map((f) => <FixtureRow key={f.id} f={f} />)}
                      </ListRowGroup>
                    </Card>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground px-1">No upcoming matches scheduled.</p>
                )}
                {past.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Past
                    </p>
                    <Card>
                      <ListRowGroup className="px-4">
                        {past.map((f) => <FixtureRow key={f.id} f={f} />)}
                      </ListRowGroup>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <ParentReportPanel playerId={player.id} playerName={player.full_name} />

      <section id="documents" className="space-y-4 mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Forms &amp; Documents</h2>
          <span className="text-sm text-muted-foreground">{currentSeason} season</span>
        </div>

        {/* Medical */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="font-semibold text-sm">Medical &amp; Emergency Info</p>
          <MedicalForm playerId={childId} initial={medical as Record<string, unknown> | null} />
        </div>

        {/* Documents */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="font-semibold text-sm">Contracts &amp; Agreements</p>
          <DocumentHub playerId={childId} season={currentSeason} documents={docs ?? []} />
        </div>
      </section>
    </div>
  );
}
