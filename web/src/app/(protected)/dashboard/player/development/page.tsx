import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DevelopmentPlanPanel } from "@/components/development/development-plan-panel";
import { MilestoneProgress } from "@/components/development/milestone-progress";
import type { MilestoneCategory } from "@/app/actions/development";

/**
 * Milestones and the development plan, split out of the passport page.
 * The passport answers "who am I as a player"; this answers "what am I
 * working on" — two different questions that were sharing one long scroll.
 */
export default async function PlayerDevelopmentPage() {
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
        <h1 className="text-2xl font-bold">My Development</h1>
        <p className="text-sm text-muted-foreground">
          Your profile isn&apos;t linked yet. Once your coach adds you, your milestones
          appear here.
        </p>
      </div>
    );
  }

  const currentSeason = new Date().getFullYear().toString();

  const { data: playerProfile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  const [{ data: milestoneTemplates }, { data: myCompletions }] = await Promise.all([
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
  ]);

  type Template = {
    id: string; title: string; description: string | null;
    category: MilestoneCategory; position: string | null;
    age_group: string | null; sort_order: number;
  };
  const templates = (milestoneTemplates ?? []) as Template[];
  const completed = new Set(
    ((myCompletions ?? []) as { template_id: string }[]).map((c) => c.template_id)
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/player" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to my passport
        </Link>
        <div>
          <h1 className="text-2xl font-bold">My Development</h1>
          <p className="text-muted-foreground text-sm mt-1">
            What you&apos;re working on this {currentSeason} season, across the five
            development categories.
          </p>
        </div>
      </div>

      {templates.length > 0 ? (
        <MilestoneProgress templates={templates} completed={completed} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No milestones set for your age group yet. Your coach adds these at the start
          of the season.
        </p>
      )}

      <section className="space-y-3">
        <DevelopmentPlanPanel playerId={player.id} />
      </section>
    </div>
  );
}
