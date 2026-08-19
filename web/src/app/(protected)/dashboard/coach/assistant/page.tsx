import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachAssistantPanel, type AssistantTeam, type AssistantFixture } from "@/components/ai/coach-assistant-panel";

export default async function CoachAssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, age_group")
    .eq("coach_id", user.id)
    .eq("active", true)
    .order("name");

  const teams = (teamRows ?? []) as AssistantTeam[];

  // Upcoming fixtures per team, for the XI and match-plan tools.
  const fixtures: Record<string, AssistantFixture[]> = {};
  if (teams.length > 0) {
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const { data: fx } = await supabase
      .from("fixtures")
      .select("id, team_id, opponent, fixture_date, is_home")
      .in("team_id", teams.map((t) => t.id))
      .eq("status", "upcoming")
      .gte("fixture_date", since)
      .order("fixture_date", { ascending: true })
      .limit(40);

    for (const f of (fx ?? []) as { id: string; team_id: string; opponent: string; fixture_date: string; is_home: boolean }[]) {
      (fixtures[f.team_id] ??= []).push({
        id: f.id,
        label: f.is_home ? `vs ${f.opponent}` : `away to ${f.opponent}`,
        when: new Date(f.fixture_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }),
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assistant</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your assistant coach. It knows your squad — who is in form, who is missing
          training, what is coming up — so the advice is about your players, not
          football in general.
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a team yet. Create one in the Squad tab and the assistant
          will have something to work with.
        </p>
      ) : (
        <CoachAssistantPanel teams={teams} fixtures={fixtures} />
      )}
    </div>
  );
}
