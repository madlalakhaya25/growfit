import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerPassportCard } from "@/components/player/player-passport-card";
import { POSITIONS, FEET } from "@/lib/types";
import {
  ALL_ATTR_SELECT,
  CORE_ATTR_SELECT,
  buildAttributeSnapshot,
  calculateOverall,
  isMissingAttributeColumn,
  type AttrKey,
} from "@/lib/attributes";
import { calculateAge, matchRatingAverage } from "@/lib/player";
import { RemovePlayerButton } from "../remove-player-button";
import { RatingEditRow } from "./rating-edit-row";
import { PlayerAttributesForm } from "./player-attributes-form";
import { RatingChart } from "@/components/rating-chart";
import { AiInsightsPanel } from "@/components/development/ai-insights-panel";
import { DevelopmentPlanPanel } from "@/components/development/development-plan-panel";
import { MilestoneCard } from "@/components/development/milestone-card";
import type { MilestoneCategory } from "@/app/actions/development";
import { ClipsSection } from "./clips-section";
import { AttributeSummary } from "@/components/player/attribute-summary";
import { ParentAccessCard, type LinkedAdult } from "@/components/records/parent-access-card";
import { listParentLinkCodes } from "@/app/actions/parent";
import { isMissingParentLinkColumn } from "@/lib/parent-link";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { PlayerPhotoUpload } from "@/components/player-photo-upload";
import { PlayerAvailabilityControl } from "@/components/records/player-availability-control";
import { ExtendedInfoForm } from "@/components/records/extended-info-form";
import { MedicalForm } from "@/components/records/medical-form";
import { DocumentHub } from "@/components/records/document-hub";
import { ProfileTabs } from "./profile-tabs";
import { reportError } from "@/lib/report-error";


export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const [{ playerId }, { team: teamParam }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await requireUser();
  const myTeamIds = await getCoachedTeamIds(supabase, user.id);

  const [{ data: player }, myAttrsResult, { data: coachTeams }, { data: memberships }, allAttrsResult] = await Promise.all([
    supabase
      .from("players")
      .select(`
        id, full_name, position, secondary_pos, preferred_foot, date_of_birth, photo_url, share_token,
        school, home_address, id_number, mysafa_number,
        availability_status, availability_note,
        player_ratings (
          id, rating, note, created_at,
          fixtures ( opponent, fixture_date )
        )
      `)
      .eq("id", playerId)
      .single(),
    supabase
      .from("player_attributes")
      .select(ALL_ATTR_SELECT)
      .eq("player_id", playerId)
      .eq("coach_id", user.id)
      .single(),
    supabase.from("teams").select("id").in("id", myTeamIds).eq("active", true),
    supabase.from("team_members").select("team_id").eq("player_id", playerId).eq("active", true),
    // Every coach's assessment, not just this one's.
    //
    // This page showed only the viewing coach's own row, while the player's
    // own dashboard, the parent's child page, the admin page and the public
    // passport all average across coaches. With several coaches on a team
    // (team_coaches, migration 019) that means a coach and that child's
    // parent were looking at two different Overalls for the same child, with
    // nothing on either screen saying so. Both are now shown, labelled.
    supabase
      .from("player_attributes")
      .select(ALL_ATTR_SELECT)
      .eq("player_id", playerId),
  ]);

  // The expanded columns (migration 013) are missing on a project that never
  // ran it, and the wide SELECT above then fails outright — which would blank
  // out an assessment the coach really has. Re-read the always-present six.
  let myAttrs: Partial<Record<AttrKey, number | null>> | null = myAttrsResult.data;
  if (!myAttrs && isMissingAttributeColumn(myAttrsResult.error)) {
    const { data: coreAttrs } = await supabase
      .from("player_attributes")
      .select(CORE_ATTR_SELECT)
      .eq("player_id", playerId)
      .eq("coach_id", user.id)
      .single();
    myAttrs = coreAttrs;
  } else if (myAttrsResult.error && myAttrsResult.error.code !== "PGRST116") {
    // PGRST116 ("no rows") is the ordinary case — this coach simply hasn't
    // rated this player yet — and isMissingAttributeColumn() already handles
    // the lagging-migration case above. Anything else (an RLS denial, an RLS
    // policy recursion, a network failure) was previously swallowed with no
    // trace at all: the attribute card just renders empty, identical to "not
    // rated yet," with nothing in any log to tell the two apart.
    reportError(myAttrsResult.error, { scope: "coach player page", extra: { query: "player_attributes (own)" } });
  }

  // Same lagging-migration fallback for the squad-wide read.
  let allAttrRows: Partial<Record<AttrKey, number | null>>[] = allAttrsResult.data ?? [];
  if (!allAttrRows.length && isMissingAttributeColumn(allAttrsResult.error)) {
    const { data: coreRows } = await supabase
      .from("player_attributes")
      .select(CORE_ATTR_SELECT)
      .eq("player_id", playerId);
    allAttrRows = coreRows ?? [];
  } else if (allAttrsResult.error) {
    reportError(allAttrsResult.error, { scope: "coach player page", extra: { query: "player_attributes (all coaches)" } });
  }

  if (!player) notFound();

  // Who can currently see this child's records, and any unused link codes.
  // Both are staff-only; `listParentLinkCodes` fails soft when migration 032
  // has not been applied, so the card degrades to "linked adults" alone.
  const [linksResult, codesResult] = await Promise.all([
    supabase
      .from("parent_player_links")
      .select("parent_id, relationship, linked_at, verification_method, profiles ( full_name )")
      .eq("player_id", playerId),
    listParentLinkCodes(playerId),
  ]);

  // `verification_method` arrives with migration 032. Until that is applied the
  // wide select above fails with 42703 and would read as "nobody is linked" —
  // the worst possible thing for this card to say. Fall back to the columns
  // that have always existed.
  let linkRows = linksResult.data;
  if (!linkRows && isMissingParentLinkColumn(linksResult.error)) {
    const { data } = await supabase
      .from("parent_player_links")
      .select("parent_id, relationship, linked_at, profiles ( full_name )")
      .eq("player_id", playerId);
    linkRows = data as typeof linkRows;
  }

  const linkedAdults: LinkedAdult[] = (linkRows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      parent_id: row.parent_id,
      full_name: (profile as { full_name: string | null } | null)?.full_name ?? null,
      relationship: row.relationship,
      linked_at: row.linked_at,
      verification_method:
        (row as { verification_method?: string | null }).verification_method ?? null,
    };
  });

  const currentSeasonForRecords = new Date().getFullYear().toString();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  const currentSeason = new Date().getFullYear().toString();

  const coachTeamIds = (coachTeams ?? []).map((t: { id: string }) => t.id);
  const playerTeamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);
  const sharedTeamIds = playerTeamIds.filter((id: string) => coachTeamIds.includes(id));
  const teamId: string | null =
    teamParam && coachTeamIds.includes(teamParam)
      ? teamParam
      : sharedTeamIds[0] ?? null;

  const [{ data: medical }, { data: milestoneTemplates }, { data: completions }, { data: clips }, { data: recentFixtures }, { data: docs }] = await Promise.all([
    supabase
      .from("player_medical")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    profile?.academy_id
      ? supabase
          .from("development_milestone_templates")
          .select("id, title, description, category, position, age_group, sort_order")
          .eq("academy_id", profile.academy_id)
          .or(`position.is.null,position.eq.${player.position ?? ""}`)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("player_milestone_completions")
      .select("template_id, note")
      .eq("player_id", playerId)
      .eq("season", currentSeason),
    supabase
      .from("player_clips")
      .select("id, title, url, timestamp_seconds, description, fixture_id, created_at")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false }),
    sharedTeamIds.length > 0
      ? supabase
          .from("fixtures")
          .select("id, opponent, fixture_date")
          .in("team_id", sharedTeamIds)
          .order("fixture_date", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as { id: string; opponent: string; fixture_date: string }[] }),
    supabase
      .from("player_documents")
      .select("document_type, status, signer_name, signed_at, uploaded_at, upload_url")
      .eq("player_id", playerId)
      .eq("season", currentSeasonForRecords),
  ]);

  type Rating = {
    id: string;
    rating: number;
    note: string | null;
    created_at: string;
    fixtures: { opponent: string; fixture_date: string } | { opponent: string; fixture_date: string }[] | null;
  };

  const ratings: Rating[] = player.player_ratings ?? [];

  // Chart data — sorted ascending by date for the trend line
  const chartData = [...ratings]
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

  // Expanded columns are nullable, and are only populated for the attributes
  // this player's position is actually assessed on.
  const initialAttrs = myAttrs;

  const ratingValues = ratings.map((r) => r.rating);
  const matchAvg = matchRatingAverage(ratingValues);

  // Overall = mean of the attributes this position is assessed on; falls back
  // to the match rating average when nothing relevant has been rated yet.
  const attrsOverall = calculateOverall(initialAttrs, player.position);
  const overall = attrsOverall ?? matchAvg;

  // The squad-wide view: every coach's assessment averaged, which is what
  // the player, their parent, the admin page and the public passport all
  // show. The big ring on this page stays the *viewing coach's* own number,
  // because that is what the form below it edits — but where the two differ,
  // both are shown so the coach knows the passport does not say what their
  // own sliders say.
  const squadSnapshot = buildAttributeSnapshot(allAttrRows, player.position);
  const otherCoachCount = Math.max(0, squadSnapshot.coachCount - (initialAttrs ? 1 : 0));
  const showBothOveralls =
    otherCoachCount > 0 &&
    squadSnapshot.overall !== null &&
    squadSnapshot.overall !== attrsOverall;

  const posLabel = POSITIONS.find((p) => p.value === player.position)?.label ?? "—";
  const footLabel = FEET.find((f) => f.value === player.preferred_foot)?.label;
  const age = calculateAge(player.date_of_birth);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={teamId ? `/dashboard/coach/squad?team=${teamId}` : "/dashboard/coach/squad"}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Squad
          </Link>
        </Button>
      </div>

      {/* The passport card stays outside the tabs and sticks on desktop:
          it answers "who am I looking at", which every tab needs. Everything
          else used to sit below it in one ten-section column — reaching the
          document hub on a phone meant scrolling past both AI panels. */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:sticky lg:top-6">
          {/* Passport card */}
          <PlayerPassportCard
            photoUrl={player.photo_url}
            fullName={player.full_name}
            overall={overall}
            posLabel={posLabel}
            badges={
              <>
                <Badge variant="brand">{posLabel}</Badge>
                {age && <Badge variant="neutral">Age {age}</Badge>}
                {footLabel && <Badge variant="neutral">{footLabel} foot</Badge>}
                {player.availability_status === "injured" && <Badge variant="danger">Injured</Badge>}
                {player.availability_status === "unavailable" && <Badge variant="warning">Unavailable</Badge>}
              </>
            }
          >
              <PlayerAvailabilityControl
                playerId={player.id}
                initialStatus={player.availability_status ?? "available"}
                initialNote={player.availability_note ?? null}
              />
              <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Ratings</p>
                  <p className="font-semibold">{ratings.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Public passport link</p>
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

              {/* Where other coaches have also assessed this player and the
                  averaged figure differs from this coach's own, say so
                  plainly. Silently showing one of the two was how a coach and
                  that child's parent ended up looking at different numbers
                  for the same child with nothing to explain it. */}
              {showBothOveralls && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Your assessment</span>
                    <span className="font-semibold tabular-nums">{attrsOverall ?? "—"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      Squad average · {squadSnapshot.coachCount} coaches
                    </span>
                    <span className="font-semibold tabular-nums">{squadSnapshot.overall}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    The passport and the player&apos;s own dashboard show the average.
                  </p>
                </div>
              )}

              {/* Attribute bars snapshot */}
              <AttributeSummary
                attrs={initialAttrs}
                position={player.position}
                className="space-y-1.5 pt-2 border-t border-border"
              />

              <div className="pt-2">
                <PlayerPhotoUpload playerId={player.id} />
              </div>

              {teamId && (
                <div className="pt-2">
                  <RemovePlayerButton playerId={player.id} playerName={player.full_name} teamId={teamId} />
                </div>
              )}
          </PlayerPassportCard>
        </div>

        <div className="lg:col-span-2">
          <ProfileTabs
            tabs={[
              {
                id: "profile",
                label: "Profile",
                content: (
                  <>
                    {/* Ratings history */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-semibold">Rating history</h2>

                      {chartData.length >= 2 && (
                        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
                          <p className="text-sm font-semibold">Rating trend</p>
                          <RatingChart data={chartData} />
                        </section>
                      )}

                      {ratings.length === 0 ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">No ratings yet</CardTitle>
                            <CardDescription>Ratings appear after matches are logged, or add one above.</CardDescription>
                          </CardHeader>
                        </Card>
                      ) : (
                        <div className="divide-y divide-border rounded-xl border border-border">
                          {[...ratings]
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((r) => {
                              const fixture = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
                              return (
                                <RatingEditRow
                                  key={r.id}
                                  ratingId={r.id}
                                  playerId={player.id}
                                  initialRating={r.rating}
                                  initialNote={r.note}
                                  opponent={fixture?.opponent ?? null}
                                  date={r.created_at}
                                />
                              );
                            })}
                        </div>
                      )}
                    </div>
                  <ClipsSection
                    playerId={player.id}
                    clips={clips ?? []}
                    fixtures={recentFixtures ?? []}
                  />

                  </>
                ),
              },
              {
                id: "assessment",
                label: "Assessment",
                content: (
                  <>
                  {/* Ability attributes */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Ability assessment</CardTitle>
                      <CardDescription>
                        Rate this player&apos;s attributes from 1–99. Your assessment is saved per player and shown on their public passport.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PlayerAttributesForm playerId={player.id} initial={initialAttrs} position={player.position} />
                    </CardContent>
                  </Card>
                  </>
                ),
              },
              {
                id: "development",
                label: "Development",
                content: (
                  <>
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
                    const completionSet = new Map(
                      (completions as Completion[] ?? []).map((c) => [c.template_id, c.note])
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

                    return (
                      <section className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-base font-semibold">Development</h2>
                          <span className="text-sm text-muted-foreground">
                            {doneCount} of {totalCount} milestone{totalCount !== 1 ? "s" : ""} complete
                          </span>
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
                                {items.map((t) => (
                                  <MilestoneCard
                                    key={t.id}
                                    templateId={t.id}
                                    playerId={player.id}
                                    season={currentSeason}
                                    title={t.title}
                                    description={t.description ?? ""}
                                    category={t.category}
                                    initialCompleted={completionSet.has(t.id)}
                                    initialNote={completionSet.get(t.id) ?? null}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    );
                  })()}

                  <section className="space-y-3 max-w-2xl">
                    <AiInsightsPanel playerId={player.id} />
                  </section>

                  <section className="space-y-3 max-w-2xl">
                    <DevelopmentPlanPanel playerId={player.id} />
                  </section>

                  </>
                ),
              },
              {
                id: "records",
                label: "Records",
                content: (
                  <>
                  <ParentAccessCard
                    playerId={player.id}
                    playerName={player.full_name}
                    linkedAdults={linkedAdults}
                    codes={codesResult.codes ?? []}
                    loadError={codesResult.error}
                  />

                  {medical && (
                    <section className="space-y-3 max-w-2xl">
                      <h2 className="text-base font-semibold">Emergency Info</h2>
                      <div className="rounded-xl border border-border bg-card divide-y divide-border">
                        {medical.emergency_1_name && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Primary contact</p>
                            <p className="font-medium">{medical.emergency_1_name} · {medical.emergency_1_relationship}</p>
                            <p className="text-sm text-muted-foreground">{medical.emergency_1_phone}</p>
                          </div>
                        )}
                        {medical.emergency_2_name && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Secondary contact</p>
                            <p className="font-medium">{medical.emergency_2_name} · {medical.emergency_2_relationship}</p>
                            <p className="text-sm text-muted-foreground">{medical.emergency_2_phone}</p>
                          </div>
                        )}
                        {(medical.allergies && medical.allergies !== 'NONE') && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Allergies</p>
                            <p className="text-sm">{medical.allergies}</p>
                          </div>
                        )}
                        {(medical.chronic_conditions && medical.chronic_conditions !== 'NONE') && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Conditions</p>
                            <p className="text-sm">{medical.chronic_conditions}</p>
                          </div>
                        )}
                        {(medical.current_medication && medical.current_medication !== 'NONE') && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Medication</p>
                            <p className="text-sm">{medical.current_medication}</p>
                          </div>
                        )}
                        {medical.nearest_hospital && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Nearest hospital</p>
                            <p className="text-sm">{medical.nearest_hospital}</p>
                          </div>
                        )}
                        {medical.blood_type && (
                          <div className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">Blood type</p>
                            <p className="font-medium">{medical.blood_type}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  <section className="space-y-6">
                    <h2 className="text-xl font-bold">Player Records</h2>

                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <p className="font-semibold">Registration Details</p>
                      <ExtendedInfoForm
                        playerId={playerId}
                        initial={{ school: player.school, home_address: player.home_address, id_number: player.id_number, mysafa_number: player.mysafa_number }}
                      />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">Medical &amp; Emergency</p>
                        {medical?.needs_renewal && (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">Renewal needed</span>
                        )}
                      </div>
                      <MedicalForm playerId={playerId} initial={medical as Record<string, unknown> | null} />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <div>
                        <p className="font-semibold">Documents &amp; Contracts · {currentSeasonForRecords}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Signed by the player&apos;s parent or guardian. Read-only view.</p>
                      </div>
                      <DocumentHub playerId={playerId} season={currentSeasonForRecords} documents={docs ?? []} readOnly />
                    </div>
                  </section>
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
