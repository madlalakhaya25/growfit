import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ChallengeBoardView } from "@/components/skill-challenges/challenge-board-view";
import { loadChallengeBoard } from "@/lib/skill-challenges-data";
import { todayIso } from "@/lib/time";

/** Ball-skill home challenges: log a score, win bronze, silver or gold. */
export default async function PlayerChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase.from("players").select("id").eq("profile_id", user.id).maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Challenges"
        description="Ball skills to practise at home. Log your best score and win a medal."
      />
      {player ? (
        <ChallengeBoardView board={await loadChallengeBoard(supabase, player.id as string, todayIso())} />
      ) : (
        <EmptyState message="Your profile isn't linked yet. Once your coach adds you, your challenges appear here." />
      )}
    </div>
  );
}
