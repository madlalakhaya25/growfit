import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingRing } from "@/components/ui/rating-ring";
import { StatBar } from "@/components/ui/stat-bar";
import { POSITIONS, FEET } from "@/lib/types";
import { ATTR_META, type AttrKey } from "@/lib/attributes";
import { calculateAge, getInitials } from "@/lib/player";
import { RemovePlayerButton } from "../remove-player-button";
import { RatingEditRow } from "./rating-edit-row";
import { PlayerAttributesForm } from "./player-attributes-form";
import { RatingChart } from "@/components/rating-chart";
import { AiInsightsPanel } from "@/components/development/ai-insights-panel";
import { DevelopmentPlanPanel } from "@/components/development/development-plan-panel";
import { MilestoneCard } from "@/components/development/milestone-card";
import type { MilestoneCategory } from "@/app/actions/development";
import { ClipsSection } from "./clips-section";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { PlayerPhotoUpload } from "@/components/player-photo-upload";
import { ExtendedInfoForm } from "@/components/records/extended-info-form";
import { MedicalForm } from "@/components/records/medical-form";
import { DocumentHub } from "@/components/records/document-hub";

const CORE_ATTR_KEYS: AttrKey[] = ["pace", "shooting", "passing", "dribbling", "defending", "physical"];

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

  const [{ data: player }, { data: myAttrs }, { data: coachTeams }, { data: memberships }] = await Promise.all([
    supabase
      .from("players")
      .select(`
        id, full_name, position, secondary_pos, preferred_foot, date_of_birth, photo_url, share_token,
        school, home_address, id_number, mysafa_number,
        player_ratings (
          id, rating, note, created_at,
          fixtures ( opponent, fixture_date )
        )
      `)
      .eq("id", playerId)
      .single(),
    supabase
      .from("player_attributes")
      .select("pace, shooting, passing, dribbling, defending, physical, ball_control, crossing, heading, tackling, finishing, first_touch, stamina, agility, jumping, strength, positioning, decision_making, composure, work_rate, leadership, shot_stopping, reflexes, distribution, handling")
      .eq("player_id", playerId)
      .eq("coach_id", user.id)
      .single(),
    supabase.from("teams").select("id").in("id", myTeamIds).eq("active", true),
    supabase.from("team_members").select("team_id").eq("player_id", playerId).eq("active", true),
  ]);

  if (!player) notFound();

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

  const initialAttrs = myAttrs as Record<AttrKey, number> | null;

  const ratingValues = ratings.map((r) => r.rating);
  const matchAvg = ratingValues.length
    ? Math.round((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length) * 20)
    : 0;

  // Overall = mean of ability attributes when assessed; falls back to match rating average
  const attrsOverall = initialAttrs
    ? Math.round(
        (initialAttrs.pace + initialAttrs.shooting + initialAttrs.passing +
         initialAttrs.dribbling + initialAttrs.defending + initialAttrs.physical) / 6
      )
    : null;
  const overall = attrsOverall ?? matchAvg;

  const posLabel = POSITIONS.find((p) => p.value === player.position)?.label ?? "—";
  const footLabel = FEET.find((f) => f.value === player.preferred_foot)?.label;
  const age = calculateAge(player.date_of_birth);
  const initials = getInitials(player.full_name);

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Passport card */}
        <Card className="overflow-hidden">
          <div className="h-1 bg-brand" />
          <CardHeader>
            <div className="flex items-center justify-between">
              {player.photo_url ? (
                <Image src={player.photo_url} alt={player.full_name} width={64} height={64} className="size-16 rounded-full object-cover" />
              ) : (
                <span className="grid size-16 place-items-center rounded-full bg-brand/20 text-lg font-bold text-primary">
                  {initials}
                </span>
              )}
              <RatingRing value={overall} size={72} />
            </div>
            <CardTitle className="mt-3">{player.full_name}</CardTitle>
            <CardDescription>{posLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">{posLabel}</Badge>
              {age && <Badge variant="neutral">Age {age}</Badge>}
              {footLabel && <Badge variant="neutral">{footLabel} foot</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Ratings</p>
                <p className="font-semibold">{ratings.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Public passport</p>
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

            {/* Attribute bars snapshot */}
            {initialAttrs && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                {CORE_ATTR_KEYS.map((key) => (
                  <StatBar key={key} label={ATTR_META[key].label} value={initialAttrs[key]} />
                ))}
              </div>
            )}

            <div className="pt-2">
              <PlayerPhotoUpload playerId={player.id} />
            </div>

            {teamId && (
              <div className="pt-2">
                <RemovePlayerButton playerId={player.id} playerName={player.full_name} teamId={teamId} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ratings history */}
        <div className="space-y-3 lg:col-span-2">
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
      </div>

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

      <ClipsSection
        playerId={player.id}
        clips={clips ?? []}
        fixtures={recentFixtures ?? []}
      />

      <section className="space-y-3 max-w-2xl">
        <AiInsightsPanel playerId={player.id} />
      </section>

      <section className="space-y-3 max-w-2xl">
        <DevelopmentPlanPanel playerId={player.id} />
      </section>

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
    </div>
  );
}
