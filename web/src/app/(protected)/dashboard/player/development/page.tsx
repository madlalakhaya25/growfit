import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DevelopmentOverview } from "@/components/development/development-overview";
import { MilestoneTimeline } from "@/components/development/milestone-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DevelopmentPlanReadonly } from "@/components/development/development-plan-readonly";
import { loadDevelopmentSnapshot } from "@/lib/development-data";
import { HomeChallengeCard } from "@/components/development/home-challenge-card";
import { pickHomeChallenge } from "@/lib/home-challenge";
import { loadSharedDevelopmentPlan } from "@/lib/shared-development-plan";
import { loadTermReview, loadSelfRatings } from "@/lib/term-review-data";
import { SelfRatingCard } from "@/components/development/self-rating-card";
import { todayIso } from "@/lib/time";
import { TrophyCabinet } from "@/components/skill-challenges/trophy-cabinet";
import { loadAttempts } from "@/lib/skill-challenges-data";
import { skillAgeBand, trophyCabinet, weeklyStreak } from "@/lib/skill-challenges";
import { loadPlayerHomework } from "@/lib/homework-data";
import { HomeworkEvidence } from "@/components/homework/homework-evidence";
import { QueryTabs } from "@/components/ui/query-tabs";
import { pickTab } from "@/lib/tabs";

const TABS = [
  { id: "progress", label: "Progress" },
  { id: "medals", label: "Medals" },
  { id: "homework", label: "Homework" },
  { id: "plan", label: "Plan" },
] as const;

/**
 * Milestones and the development plan, split out of the passport page.
 * The passport answers "who am I as a player"; this answers "what am I
 * working on" — two different questions that were sharing one long scroll.
 */
export default async function PlayerDevelopmentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const tab = pickTab(TABS, (await searchParams).tab);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id, position")
    .eq("profile_id", user.id)
    .single();

  if (!player) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Development" />
        <EmptyState message="Your profile isn't linked yet. Once your coach adds you, your milestones appear here." />
      </div>
    );
  }

  const { data: playerProfile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  const onProgress = tab === "progress";
  const needsAge = onProgress || tab === "medals";

  const snapshot = await loadDevelopmentSnapshot(supabase, {
    playerId: player.id,
    academyId: playerProfile?.academy_id ?? null,
    position: player.position ?? null,
  });

  // The player's own rating of themself. Nothing appears until terms exist.
  const termReview = onProgress && playerProfile?.academy_id
    ? await loadTermReview(supabase, player.id, playerProfile.academy_id as string, todayIso())
    : null;
  const selfRatings = termReview?.term ? await loadSelfRatings(supabase, player.id, termReview.term.id) : {};
  const { data: teamRow } = needsAge
    ? await supabase
        .from("team_members")
        .select("teams ( age_group )")
        .eq("player_id", player.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle()
    : { data: null };
  const teams = (teamRow as { teams: { age_group: string | null } | { age_group: string | null }[] | null } | null)?.teams;
  const ageGroup = (Array.isArray(teams) ? teams[0] : teams)?.age_group ?? null;

  const shared = tab === "plan" ? await loadSharedDevelopmentPlan(supabase, player.id) : null;
  // Ball-skill medals count as evidence for the Technical category. Hidden
  // until migration 064 has run.
  const skillAttempts = tab === "medals" ? await loadAttempts(supabase, [player.id]) : { available: false, rows: [] };
  const challenge = shared ? pickHomeChallenge(shared.plan) : null;
  const homework = tab === "homework" ? await loadPlayerHomework(supabase, player.id) : { rows: [] };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/player" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to my passport
      </Link>
      <PageHeader
        title="My Development"
        description={`What you're working on this ${snapshot.currentSeason} season, across the five development categories.`}
      />

      <QueryTabs tabs={TABS} active={tab} basePath="/dashboard/player/development" />

      {tab === "progress" && (
        <>
      {termReview?.term && (
        <SelfRatingCard
          termId={termReview.term.id}
          termName={termReview.term.name}
          ageGroup={ageGroup}
          initial={selfRatings}
        />
      )}

      <DevelopmentOverview snapshot={snapshot} audience="player" />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">My journey</h2>
        <MilestoneTimeline snapshot={snapshot} audience="player" />
      </section>

        </>
      )}

      {tab === "medals" && (
        <>
      {!skillAttempts.available && <EmptyState message="Your ball-skill medals show here once home challenges are set up." />}
      {skillAttempts.available && (
        <TrophyCabinet
          results={trophyCabinet(skillAgeBand(ageGroup), skillAttempts.rows)}
          streak={weeklyStreak(skillAttempts.rows.map((r) => r.logged_at), todayIso())}
          heading="Ball-skill medals"
          emptyMessage="Win a medal in a home challenge and it shows here as proof of your skills."
          href="/dashboard/player/challenges"
          showCategory
        />
      )}

        </>
      )}

      {tab === "homework" && (
        <>
      {/* Evidence for the Tactical category: plays studied at home. */}
      {homework.rows.length === 0 && <EmptyState message="No homework yet. Plays your coach sets for you show here." />}
      <HomeworkEvidence rows={homework.rows} audience="player" />

        </>
      )}

      {tab === "plan" && (
        <>
      {/* Only a plan a coach has approved is ever shown here; the generator is
          coach-only (Phase 0 of docs/AI_AND_UX_PLAN_2026.md). */}
      {challenge && <HomeChallengeCard challenge={challenge} audience="player" />}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">My plan</h2>
        {shared ? (
          <DevelopmentPlanReadonly plan={shared.plan} approvedByName={shared.approvedByName} audience="player" />
        ) : (
          <EmptyState
            icon={Target}
            message="Your coach shares your personal development plan with you once it's ready."
          />
        )}
      </section>
        </>
      )}
    </div>
  );
}
