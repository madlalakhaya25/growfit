import Link from "next/link";
import { ExternalLink, FileText, ChevronRight, Target, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatBar } from "@/components/ui/stat-bar";
import { POSITIONS } from "@/lib/types";
import { calculateAge, matchRatingAverage } from "@/lib/player";
import { formatDayMonth } from "@/lib/time";
import { RemovePlayerPhotoButton } from "@/components/remove-player-photo-button";
import { CopyButton } from "@/components/copy-button";
import { AttributeSummary } from "@/components/player/attribute-summary";
import { PlayerPassportCard } from "@/components/player/player-passport-card";
import { ClaimProfileForm } from "./claim-profile-form";
import { RatingChart } from "@/components/rating-chart";
import { MediaGallery } from "@/components/media/media-gallery";
import { MyPositionPanel } from "@/components/tactics/my-position-panel";
import {
  ALL_ATTR_SELECT,
  CORE_ATTR_SELECT,
  averageAttributeRows,
  calculateOverall,
  isMissingAttributeColumn,
  type AttrKey,
} from "@/lib/attributes";
import { reportError } from "@/lib/report-error";
import { signPlayerPhotoUrl } from "@/lib/player-photo";



export default async function PlayerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // player_attributes is fetched separately from the base player row, not
  // embedded in one combined select. It used to be embedded — but a lagging
  // migration (attribute columns are optional at runtime; see
  // isMissingAttributeColumn below) failed the WHOLE query when embedded,
  // which made a genuinely linked player's entire passport disappear behind
  // the "not yet linked, waiting to be added" screen. Same fix already
  // applied on the coach's player-detail page; see isMissingAttributeColumn's
  // doc comment in lib/attributes.ts for the general pattern.
  //
  // player_attributes.player_id refers to players.id, not this profile's own
  // id, so it can't be fetched in parallel with the row that resolves it —
  // this has to run after `player` comes back.
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(`
      id, full_name, position, preferred_foot, date_of_birth, photo_url, share_token, mysafa_number, id_number,
      player_ratings ( rating, created_at, fixtures ( opponent, fixture_date ) )
    `)
    .eq("profile_id", user.id)
    .single();

  if (!player) {
    // .single() also errors (PGRST116) when it simply finds no matching row —
    // that's the genuine "this account isn't linked to a player yet" case.
    // Any other error means the query itself failed (RLS, network, a lagging
    // migration), and showing the same "waiting to be added" screen for that
    // is exactly the bug this page was already fixed for once: a real query
    // failure made a genuinely linked player look unclaimed.
    const notYetLinked = !playerError || playerError.code === "PGRST116";
    if (!notYetLinked) {
      reportError(playerError, { scope: "player dashboard", extra: { query: "players" } });
    }
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Passport</h1>

        {notYetLinked ? (
          <>
            <div className="rounded-xl border border-border bg-card p-6 space-y-2">
              <p className="text-base font-semibold">You&apos;re all set — waiting to be added</p>
              <p className="text-sm text-muted-foreground">
                Your account is ready. As soon as your coach adds you to a squad, your
                passport, ratings and fixtures appear here automatically. If your coach
                has already given you a share token, enter it below to link your profile now.
              </p>
            </div>

            <ClaimProfileForm />
          </>
        ) : (
          <div className="rounded-xl border border-destructive/50 bg-card p-6 space-y-2">
            <p className="text-base font-semibold">Couldn&apos;t load your passport</p>
            <p className="text-sm text-muted-foreground">
              Something went wrong loading your profile. Try refreshing the
              page — if it keeps happening, let your coach or administrator know.
            </p>
          </div>
        )}
      </div>
    );
  }

  const photoUrl = await signPlayerPhotoUrl(supabase, player.photo_url);

  const wideAttrs = await supabase
    .from("player_attributes")
    .select(ALL_ATTR_SELECT)
    .eq("player_id", player.id);

  let attrsData: Partial<Record<AttrKey, number | null>>[] | null = wideAttrs.data;
  let attrsError = wideAttrs.error;
  if (isMissingAttributeColumn(wideAttrs.error)) {
    const coreAttrs = await supabase
      .from("player_attributes")
      .select(CORE_ATTR_SELECT)
      .eq("player_id", player.id);
    attrsData = coreAttrs.data;
    attrsError = coreAttrs.error;
  }
  if (attrsError) {
    // Not a missing-column case (that's handled above) — a genuine failure.
    // Degrade to "no attribute ratings shown" rather than taking the whole
    // passport down, but don't drop it silently: log it, and say so near the
    // attribute summary below rather than rendering it identically to "no
    // assessment yet".
    reportError(attrsError, { scope: "player dashboard", extra: { query: "player_attributes" } });
  }

  const currentSeason = new Date().getFullYear().toString();

  const { data: playerProfile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  type ClipRow = { id: string; title: string; url: string; timestamp_seconds: number | null; description: string | null; created_at: string };

  const [{ data: myDocuments }, { data: myMediaTags }, { data: milestoneTemplates }, { data: myCompletions }, { data: myClipsRaw }] = await Promise.all([
    supabase
      .from("player_documents")
      .select("document_type, status, signer_name, signed_at, uploaded_at, upload_url")
      .eq("player_id", player.id)
      .eq("season", currentSeason),
    supabase
      .from("media_tags")
      .select("media_uploads ( id, url, media_type, caption, created_at )")
      .eq("player_id", player.id),
    playerProfile?.academy_id
      ? supabase
          .from("development_milestone_templates")
          .select("id, title, description, category, position, age_group, sort_order")
          .eq("academy_id", playerProfile.academy_id)
          .or(`position.is.null,position.eq.${player.position ?? ""}`)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("player_milestone_completions")
      .select("template_id, note")
      .eq("player_id", player.id)
      .eq("season", currentSeason),
    supabase
      .from("player_clips")
      .select("id, title, url, timestamp_seconds, description, created_at")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false }),
  ]);

  const myClips = (myClipsRaw ?? []) as ClipRow[];

  // Ratings
  type RatingRow = {
    rating: number;
    created_at: string;
    fixtures: { opponent: string; fixture_date: string } | { opponent: string; fixture_date: string }[] | null;
  };
  const ratingRows: RatingRow[] = player.player_ratings ?? [];
  const ratingValues = ratingRows.map((r) => r.rating);

  // Chart data — sorted ascending by date
  const chartData = [...ratingRows]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((r) => {
      const fixture = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
      const dateStr = fixture?.fixture_date ?? r.created_at;
      return {
        date: formatDayMonth(dateStr),
        rating: r.rating,
        opponent: fixture?.opponent ?? undefined,
      };
    });
  const matchAvg = matchRatingAverage(ratingValues);

  // Attributes — averaged across every coach who assessed this player.
  type AttrRow = Partial<Record<AttrKey, number | null>>;
  const attrRows: AttrRow[] = (attrsData ?? []) as AttrRow[];
  const attrs = averageAttributeRows(attrRows);

  // Overall: mean of the attributes this position is assessed on, else the
  // match rating average.
  const attrsOverall = calculateOverall(attrs, player.position);
  const overall = attrsOverall ?? matchAvg;

  const positionEntry = POSITIONS.find((p) => p.value === player.position);
  const posLabel = positionEntry?.label ?? "—";
  const age = calculateAge(player.date_of_birth);
  // Age band for the positional guide: round up to the next odd year, giving
  // U11 / U13 / U15 etc. Falls back to U15 when we have no date of birth.
  const playerAgeGroup = age ? `U${age % 2 === 1 ? age : age + 1}` : "U15";

  // Normalize media tag items
  type RawMediaUpload = {
    id: string;
    url: string;
    media_type: string;
    caption: string | null;
    created_at: string;
  } | null;
  type RawMediaTag = { media_uploads: RawMediaUpload | RawMediaUpload[] };
  const taggedMediaItems = (myMediaTags ?? []).flatMap((tag: RawMediaTag) => {
    const mu = tag.media_uploads;
    if (!mu) return [];
    const items = Array.isArray(mu) ? mu : [mu];
    return items.filter((item): item is NonNullable<RawMediaUpload> => item !== null).map((item) => ({
      id: item.id,
      url: item.url,
      media_type: item.media_type,
      caption: item.caption,
      created_at: item.created_at,
      tagged_players: [],
    }));
  });

  const needsRegistration = !player.mysafa_number && !player.id_number;
  const docsSigned = (myDocuments ?? []).filter(
    (d: { status: string }) => d.status === "signed" || d.status === "uploaded"
  ).length;
  const docsOutstanding = Math.max(0, 6 - docsSigned);
  const milestoneTotal = (milestoneTemplates ?? []).length;
  const milestoneDone = (() => {
    const done = new Set(((myCompletions ?? []) as { template_id: string }[]).map((c) => c.template_id));
    return ((milestoneTemplates ?? []) as { id: string }[]).filter((t) => done.has(t.id)).length;
  })();
  const milestonePct = milestoneTotal > 0 ? Math.round((milestoneDone / milestoneTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Passport</h1>

      {needsRegistration && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 flex items-start gap-3">
          <span className="mt-0.5 text-amber-600 dark:text-amber-400 text-lg leading-none">!</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Complete your profile</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Add your MySAFA number and ID number to keep your profile up to date.{" "}
              <a href="#registration" className="underline font-medium">Add now ↓</a>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Profile card */}
        <PlayerPassportCard
          className="sm:col-span-2 lg:col-span-1"
          variant="inline"
          photoUrl={photoUrl}
          fullName={player.full_name}
          overall={overall}
          posLabel={posLabel}
          photoSize={48}
          ringSize={84}
          badges={
            <>
              <Badge variant="brand">{posLabel}</Badge>
              {age && <Badge variant="neutral">Age {age}</Badge>}
              {player.preferred_foot && (
                <Badge variant="neutral" className="capitalize">
                  {player.preferred_foot} foot
                </Badge>
              )}
            </>
          }
        >
          {player.photo_url && <RemovePlayerPhotoButton playerId={player.id} />}
          {attrsError && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Couldn&apos;t load your attribute ratings right now.
            </p>
          )}
          <AttributeSummary
            attrs={attrs}
            position={player.position}
            className="space-y-1.5 pt-2 border-t border-border"
          />
        </PlayerPassportCard>

        {/* Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>
              {ratingValues.length} rating{ratingValues.length !== 1 ? "s" : ""} from coaches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ratingValues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No match ratings yet.</p>
            ) : (
              <StatBar label="Average" value={matchAvg} />
            )}
          </CardContent>
        </Card>

        {/* Share */}
        <Card>
          <CardHeader>
            <CardTitle>Share Passport</CardTitle>
            <CardDescription>
              Your public page includes a QR code scouts can scan. This code
              identifies your passport — it does not give anyone access to your
              records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-md bg-muted px-4 py-3">
              <p className="font-mono text-lg font-bold tracking-widest">
                {player.share_token}
              </p>
              <CopyButton text={player.share_token} />
            </div>
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link href={`/passport/${player.share_token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                View public passport &amp; QR
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <a href={`/api/players/${player.id}/card`}>
                <Download className="size-4" aria-hidden="true" />
                Download player card
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Development lives on its own page — this page is about who you are as a player. */}
      <Link
        href="/dashboard/player/development"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Target className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">My Development</span>
          <span className="block text-xs text-muted-foreground">
            {milestoneTotal > 0
              ? `${milestoneDone} of ${milestoneTotal} milestones done · ${milestonePct}%`
              : "Milestones and your development plan"}
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Link>

      {positionEntry && (
        <section className="space-y-3">
          <MyPositionPanel
            positionLabel={positionEntry.label}
            positionGroup={positionEntry.group}
            ageGroup={playerAgeGroup}
          />
        </section>
      )}

      {chartData.length >= 2 ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-semibold">Rating trend</p>
          <RatingChart data={chartData} />
        </section>
      ) : chartData.length === 1 ? (
        <section className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm font-semibold">Rating trend</p>
          <p className="text-sm text-muted-foreground mt-1">
            Rating trend appears after 2 or more rated matches. You have 1 so far, keep going!
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">My Photos &amp; Videos</h2>
        {taggedMediaItems.length > 0 ? (
          <MediaGallery items={taggedMediaItems} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No media yet. Coaches will tag you in match photos and videos as they upload them.
          </p>
        )}
      </section>

      {myClips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">My Clips</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {myClips.map((clip) => (
              <div key={clip.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-medium leading-snug">{clip.title}</p>
                    {clip.timestamp_seconds !== null && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">
                        {Math.floor(clip.timestamp_seconds / 60)}:{String(clip.timestamp_seconds % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  {clip.description && (
                    <p className="text-sm text-muted-foreground">{clip.description}</p>
                  )}
                  <a
                    href={clip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    Watch clip
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paperwork lives on its own page so the passport stays about football. */}
      <Link
        href="/dashboard/player/records"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">My Records</span>
          <span className="block text-xs text-muted-foreground">
            Registration numbers and {currentSeason} season documents
            {docsOutstanding > 0 ? ` · ${docsOutstanding} still outstanding` : ""}
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Link>
    </div>
  );
}
