import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingRing } from "@/components/ui/rating-ring";
import { StatBar } from "@/components/ui/stat-bar";
import { POSITIONS } from "@/lib/types";
import { ClaimProfileForm } from "./claim-profile-form";
import { RatingChart } from "@/components/rating-chart";
import { MediaGallery } from "@/components/media/media-gallery";
import { DocumentHub } from "@/components/records/document-hub";
import { PlayerIdentityForm } from "@/components/records/player-identity-form";
import type { MilestoneCategory } from "@/app/actions/development";
import { DevelopmentPlanPanel } from "@/components/development/development-plan-panel";
import { MyPositionPanel } from "@/components/tactics/my-position-panel";

const ATTR_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const;
type AttrKey = (typeof ATTR_KEYS)[number];

const ATTR_LABELS: Record<AttrKey, string> = {
  pace: "Pace", shooting: "Shooting", passing: "Passing",
  dribbling: "Dribbling", defending: "Defending", physical: "Physical",
};

export default async function PlayerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select(`
      id, full_name, position, preferred_foot, date_of_birth, photo_url, share_token, mysafa_number, id_number,
      player_ratings ( rating, created_at, fixtures ( opponent, fixture_date ) ),
      player_attributes ( pace, shooting, passing, dribbling, defending, physical )
    `)
    .eq("profile_id", user.id)
    .single();

  if (!player) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Passport</h1>

        <div className="rounded-xl border border-border bg-card p-6 space-y-2">
          <p className="text-base font-semibold">You&apos;re all set — waiting to be added</p>
          <p className="text-sm text-muted-foreground">
            Your account is ready. As soon as your coach adds you to a squad, your
            passport, ratings and fixtures appear here automatically. If your coach
            has already given you a share token, enter it below to link your profile now.
          </p>
        </div>

        <ClaimProfileForm />
      </div>
    );
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
        date: new Date(dateStr).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }),
        rating: r.rating,
        opponent: fixture?.opponent ?? undefined,
      };
    });
  const matchAvg = ratingValues.length
    ? Math.round((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length) * 20)
    : 0;

  // Attributes — average across all coaches who assessed this player
  type AttrRow = Record<AttrKey, number>;
  const attrRows: AttrRow[] = (player.player_attributes ?? []) as AttrRow[];
  const attrs = attrRows.length > 0
    ? Object.fromEntries(
        ATTR_KEYS.map((key) => [
          key,
          Math.round(attrRows.reduce((s, r) => s + r[key], 0) / attrRows.length),
        ])
      ) as Record<AttrKey, number>
    : null;

  // Overall: average of attributes if assessed, else match rating average
  const attrsOverall = attrs
    ? Math.round(ATTR_KEYS.reduce((s, k) => s + attrs[k], 0) / ATTR_KEYS.length)
    : null;
  const overall = attrsOverall ?? matchAvg;

  const positionEntry = POSITIONS.find((p) => p.value === player.position);
  const posLabel = positionEntry?.label ?? "—";
  const age = player.date_of_birth
    ? Math.floor((Date.now() - new Date(player.date_of_birth).getTime()) / 31_557_600_000)
    : null;
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
        <Card className="overflow-hidden sm:col-span-2 lg:col-span-1">
          <div className="h-1 bg-brand" />
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{player.full_name}</CardTitle>
              <CardDescription>{posLabel}</CardDescription>
            </div>
            <RatingRing value={overall} size={84} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">{posLabel}</Badge>
              {age && <Badge variant="neutral">Age {age}</Badge>}
              {player.preferred_foot && (
                <Badge variant="neutral" className="capitalize">
                  {player.preferred_foot} foot
                </Badge>
              )}
            </div>
            {attrs && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                {ATTR_KEYS.map((key) => (
                  <StatBar key={key} label={ATTR_LABELS[key]} value={attrs[key]} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
            <CardDescription>Your public page includes a QR code scouts can scan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-md bg-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-widest">
              {player.share_token}
            </p>
            <Button asChild variant="outline" size="sm" className="w-full gap-2">
              <Link href={`/passport/${player.share_token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                View public passport &amp; QR
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {(milestoneTemplates ?? []).length > 0 && (() => {
        type MilestoneTemplate = {
          id: string;
          title: string;
          description: string | null;
          category: MilestoneCategory;
          position: string | null;
          age_group: string | null;
          sort_order: number;
        };
        type Completion = { template_id: string; note: string | null };

        const templates = milestoneTemplates as MilestoneTemplate[];
        const completionSet = new Set(
          (myCompletions as Completion[] ?? []).map((c) => c.template_id)
        );

        const CATEGORIES: MilestoneCategory[] = ["technical", "tactical", "physical", "mental", "leadership"];
        const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
          technical: "Technical", tactical: "Tactical", physical: "Physical",
          mental: "Mental", leadership: "Leadership",
        };
        const CATEGORY_STYLES: Record<MilestoneCategory, string> = {
          technical: "bg-blue-500/15 text-blue-700 border-transparent",
          tactical: "bg-violet-500/15 text-violet-700 border-transparent",
          physical: "bg-orange-500/15 text-orange-700 border-transparent",
          mental: "bg-teal-500/15 text-teal-700 border-transparent",
          leadership: "bg-amber-500/15 text-amber-700 border-transparent",
        };

        const totalCount = templates.length;
        const doneCount = templates.filter((t) => completionSet.has(t.id)).length;
        const overallPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        const CATEGORY_BAR_COLORS: Record<MilestoneCategory, string> = {
          technical: "bg-blue-500",
          tactical: "bg-violet-500",
          physical: "bg-orange-500",
          mental: "bg-teal-500",
          leadership: "bg-amber-500",
        };

        return (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">My Development</h2>
              <span className="text-sm text-muted-foreground font-medium">
                {doneCount}/{totalCount} &middot; {overallPct}%
              </span>
            </div>

            {/* Overall progress bar */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Overall progress</span>
                <span>{overallPct}% complete</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {CATEGORIES.map((cat) => {
                  const catItems = templates.filter((t) => t.category === cat);
                  if (catItems.length === 0) return null;
                  const catDone = catItems.filter((t) => completionSet.has(t.id)).length;
                  const catPct = Math.round((catDone / catItems.length) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${CATEGORY_BAR_COLORS[cat]}`}
                          style={{ width: `${catPct}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-center text-muted-foreground uppercase tracking-wide truncate">
                        {CATEGORY_LABELS[cat]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {CATEGORIES.map((cat) => {
              const items = templates.filter((t) => t.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {CATEGORY_LABELS[cat]}
                    </p>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[cat]}`}>
                      {items.filter((t) => completionSet.has(t.id)).length}/{items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((t) => {
                      const done = completionSet.has(t.id);
                      return (
                        <div key={t.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                          <div className="mt-0.5 flex-shrink-0 size-5 rounded-full border-2 border-border flex items-center justify-center"
                            style={done ? { backgroundColor: "currentColor", borderColor: "currentColor" } : undefined}>
                            {done && (
                              <svg viewBox="0 0 12 12" className="size-full text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium leading-snug ${done ? "text-muted-foreground" : ""}`}>
                                {t.title}
                              </p>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${CATEGORY_STYLES[cat]}`}>
                                {CATEGORY_LABELS[cat]}
                              </span>
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })()}

      {positionEntry && (
        <section className="space-y-3">
          <MyPositionPanel
            positionLabel={positionEntry.label}
            positionGroup={positionEntry.group}
            ageGroup={playerAgeGroup}
          />
        </section>
      )}

      <section className="space-y-3">
        <DevelopmentPlanPanel playerId={player.id} />
      </section>

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

      <section id="registration" className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">My Registration Numbers</h2>
          <p className="text-sm text-muted-foreground">
            Keep these up to date so your parent can link their account to your profile.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <PlayerIdentityForm
            playerId={player.id}
            initial={{ mysafa_number: player.mysafa_number, id_number: player.id_number }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Documents &amp; Contracts</h2>
          <p className="text-sm text-muted-foreground">{currentSeason} season — your parent or guardian signs these on your behalf.</p>
        </div>
        <DocumentHub playerId={player.id} season={currentSeason} documents={myDocuments ?? []} readOnly />
      </section>
    </div>
  );
}
