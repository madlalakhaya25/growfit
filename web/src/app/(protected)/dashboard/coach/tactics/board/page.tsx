import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TacticalBoard, type BoardTeam } from "@/components/tactics/tactical-board";
import { getCoachedTeamIds } from "@/lib/coached-teams";

type MemberRow = {
  active: boolean;
  players: { id: string; full_name: string; position: string | null } | { id: string; full_name: string; position: string | null }[] | null;
};
type TeamRow = {
  id: string;
  name: string;
  age_group: string | null;
  team_members: MemberRow[] | null;
};

export default async function CoachBoardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("teams")
    .select("id, name, age_group, team_members(active, players(id, full_name, position))")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("name");

  const teams: BoardTeam[] = ((data ?? []) as TeamRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    age_group: t.age_group,
    players: (t.team_members ?? [])
      .filter((m) => m.active && m.players)
      .flatMap((m) => (Array.isArray(m.players) ? m.players : [m.players!]))
      .map((p) => ({ id: p.id, full_name: p.full_name, position: p.position })),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/coach/tactics" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Tactics
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Tactical Board</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set up your real squad in a formation, drag players to shape it, and draw
            runs and passing lines to walk through a plan.
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a team yet. Create one in the Squad tab, then come back to
          build a plan with your players.
        </p>
      ) : (
        <TacticalBoard teams={teams} />
      )}
    </div>
  );
}
