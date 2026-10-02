import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
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
  computeSquadMedians,
  getQuickAssessKeys,
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
import { DevelopmentOverview } from "@/components/development/development-overview";
import { MilestoneTimeline } from "@/components/development/milestone-timeline";
import { loadDevelopmentSnapshot } from "@/lib/development-data";
import { getLatestAiArtefact } from "@/lib/ai-artefacts";
import type { DevelopmentPlanStructured } from "@/lib/development-plan-schema";
import { currentSeason as seasonKey } from "@/lib/development-categories";
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
import { formatDayMonth, todayIso } from "@/lib/time";
import { signPlayerPhotoUrl } from "@/lib/player-photo";
import { loadTermReview } from "@/lib/term-review-data";
import { TermReviewCard } from "@/components/development/term-review-card";


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
      .select(`${ALL_ATTR_SELECT}, notes`)
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

  const photoUrl = await signPlayerPhotoUrl(supabase, player.photo_url);

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

  const currentSeasonForRecords = seasonKey();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  const coachTeamIds = (coachTeams ?? []).map((t: { id: string }) => t.id);
  const playerTeamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);
  const sharedTeamIds = playerTeamIds.filter((id: string) => coachTeamIds.includes(id));
  const teamId: string | null =
    teamParam && coachTeamIds.includes(teamParam)
      ? teamParam
      : sharedTeamIds[0] ?? null;

  // Squad-wide attribute rows for quick-assess mode's median ticks
  // (docs/BACKLOG.md 2.6) — same lagging-migration fallback as the two
  // player_attributes reads above.
  const squadAttrsResult = teamId
    ? await supabase
        .from("team_members")
        .select(`players ( position, player_attributes ( ${ALL_ATTR_SELECT} ) )`)
        .eq("team_id", teamId)
        .eq("active", true)
    : { data: null, error: null };

  type SquadAttrPlayer = { position: string | null; player_attributes: Partial<Record<AttrKey, number | null>>[] | null };
  let squadAttrPlayers: SquadAttrPlayer[] = (
    (squadAttrsResult.data ?? []) as unknown as { players: SquadAttrPlayer | SquadAttrPlayer[] | null }[]
  ).flatMap((m) => (m.players ? (Array.isArray(m.players) ? m.players : [m.players]) : []));

  if (squadAttrPlayers.length === 0 && teamId && isMissingAttributeColumn(squadAttrsResult.error)) {
    const { data: coreRows } = await supabase
      .from("team_members")
      .select(`players ( position, player_attributes ( ${CORE_ATTR_SELECT} ) )`)
      .eq("team_id", teamId)
      .eq("active", true);
    squadAttrPlayers = ((coreRows ?? []) as unknown as { players: SquadAttrPlayer | SquadAttrPlayer[] | null }[])
      .flatMap((m) => (m.players ? (Array.isArray(m.players) ? m.players : [m.players]) : []));
  }

  // Term review: absent until migrations 053 and 054 are run, then the card appears.
  const termReview = profile?.academy_id
    ? await loadTermReview(supabase, playerId, profile.academy_id as string, todayIso())
    : null;
  const { data: reviewTeam } = teamId
    ? await supabase.from("teams").select("age_group").eq("id", teamId).single()
    : { data: null };

  const quickAssessKeys = getQuickAssessKeys(player?.position);
  const squadMedians = computeSquadMedians(squadAttrPlayers, quickAssessKeys);

  const [{ data: medical }, developmentSnapshot, savedPlan, savedInsights, { data: clips }, { data: recentFixtures }, { data: docs }] = await Promise.all([
    supabase
      .from("player_medical")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    // One read path for the pathway, shared with the player and parent
    // views. A failed query comes back as `loadError`, not as an empty list.
    loadDevelopmentSnapshot(supabase, {
      playerId,
      academyId: profile?.academy_id ?? null,
      position: player.position ?? null,
      resolveCompletedBy: true,
    }),
    // The stored plan, so Tuesday's plan is still here on Wednesday. Reads as
    // "no plan yet" if migration 045 hasn't been applied (available: false).
    getLatestAiArtefact<DevelopmentPlanStructured>(supabase, {
      kind: "development_plan",
      subjectType: "player",
      subjectId: playerId,
    }),
    getLatestAiArtefact<{ text?: string }>(supabase, {
      kind: "player_insights",
      subjectType: "player",
      subjectId: playerId,
    }),
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
        date: formatDayMonth(dateStr),
        rating: r.rating,
        opponent: fixture?.opponent ?? undefined,
      };
    });

  // Expanded columns are nullable, and are only populated for the attributes
  // this player's position is actually assessed on.
  const initialAttrs = myAttrs;
  const myNotes = (myAttrsResult.data as { notes?: string | null } | null)?.notes ?? null;

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
            photoUrl={photoUrl}
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

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <PlayerPhotoUpload playerId={player.id} />
                <a
                  href={`/print/term-report/${player.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <FileText className="size-3.5" aria-hidden="true" />
                  Term report
                </a>
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
                  {termReview?.term && (
                    <TermReviewCard
                      playerId={player.id}
                      termId={termReview.term.id}
                      termName={termReview.term.name}
                      ageGroup={(reviewTeam as { age_group: string | null } | null)?.age_group ?? null}
                      initial={termReview.current}
                      last={termReview.last}
                      lastTermName={termReview.previous?.name ?? null}
                    />
                  )}
                  {/* Ability attributes */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Ability assessment</CardTitle>
                      <CardDescription>
                        Rate this player&apos;s attributes from 1–99. Your assessment is saved per player and shown on their public passport.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PlayerAttributesForm
                        playerId={player.id}
                        initial={initialAttrs}
                        initialNotes={myNotes}
                        position={player.position}
                        squadMedians={squadMedians}
                      />
                    </CardContent>
                  </Card>
                  </>
                ),
              },
              {
                id: "development",
                label: "Development",
                content: (
                  <ProfileTabs
                    ariaLabel="Development sections"
                    idPrefix="dev-"
                    tabs={[
                      {
                        id: "milestones",
                        label: "Milestones",
                        content: (
                          <DevelopmentOverview snapshot={developmentSnapshot} audience="coach" playerId={player.id} />
                        ),
                      },
                      {
                        id: "plan",
                        label: "Plan",
                        content: (
                          <>
                            <section className="max-w-2xl space-y-3">
                              <DevelopmentPlanPanel
                                playerId={player.id}
                                initial={
                                  savedPlan.artefact
                                    ? {
                                        artefactId: savedPlan.artefact.id,
                                        plan: savedPlan.artefact.prose ?? "",
                                        generatedAt: savedPlan.artefact.createdAt,
                                        status: savedPlan.artefact.status,
                                        approvedByName: savedPlan.artefact.approvedByName,
                                        feedback: savedPlan.artefact.feedback,
                                      }
                                    : null
                                }
                              />
                            </section>
                            <section className="max-w-2xl space-y-3">
                              <AiInsightsPanel
                                playerId={player.id}
                                initial={
                                  savedInsights.artefact
                                    ? {
                                        artefactId: savedInsights.artefact.id,
                                        text: savedInsights.artefact.prose ?? savedInsights.artefact.data?.text ?? "",
                                        generatedAt: savedInsights.artefact.createdAt,
                                        feedback: savedInsights.artefact.feedback,
                                      }
                                    : null
                                }
                              />
                            </section>
                          </>
                        ),
                      },
                      {
                        id: "history",
                        label: "History",
                        content: <MilestoneTimeline snapshot={developmentSnapshot} audience="coach" />,
                      },
                    ]}
                  />
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
