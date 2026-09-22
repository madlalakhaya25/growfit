import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachAssistantPanel, type AssistantTeam, type AssistantFixture } from "@/components/ai/coach-assistant-panel";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import type { BoardPlayer } from "@/lib/board-model";

type MemberRow = {
  active: boolean;
  players: { id: string; full_name: string; position: string | null } | { id: string; full_name: string; position: string | null }[] | null;
};
type TeamWithRosterRow = {
  id: string;
  team_members: MemberRow[] | null;
};

export default async function CoachAssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, age_group, team_members(active, players(id, full_name, position))")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("name");

  const teams = (teamRows ?? []) as (AssistantTeam & TeamWithRosterRow)[];

  // Rosters keyed by team id — same shape board/page.tsx already loads for
  // the tactical board — so the assistant's Apply-suggested-XI flow can
  // match a suggested name to a real player without a second round trip.
  const roster: Record<string, BoardPlayer[]> = {};
  for (const t of teams) {
    roster[t.id] = (t.team_members ?? [])
      .filter((m) => m.active && m.players)
      .flatMap((m) => (Array.isArray(m.players) ? m.players : [m.players!]))
      .map((p) => ({ id: p.id, full_name: p.full_name, position: p.position }));
  }

  // Upcoming fixtures per team, for the XI and match-plan tools.
  const fixtures: Record<string, AssistantFixture[]> = {};
  if (teams.length > 0) {
    // react-hooks/purity flags any impure call in a component body, but this
    // is a Server Component: it renders once, server-side, per request, with
    // no client-side reconciliation of this value to diverge from -- unlike a
    // Client Component (see new-session-form.tsx's real fix for that case),
    // there's no hydration pass here that could disagree with the server's
    // answer. The rule can't distinguish the two component kinds.
    // eslint-disable-next-line react-hooks/purity
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
        <CoachAssistantPanel teams={teams} fixtures={fixtures} roster={roster} />
      )}
    </div>
  );
}
