import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AddPlayerTabs } from "./add-player-tabs";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function AddPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, academy_id")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = allTeams.find((t) => t.id === teamParam) ?? allTeams[0];

  // Players in the academy NOT already in this squad
  const { data: squadMembers } = await supabase
    .from("team_members")
    .select("player_id")
    .eq("team_id", team.id)
    .eq("active", true);

  const squadIds = (squadMembers ?? []).map((m: { player_id: string }) => m.player_id);

  // squadIds empty → no exclusions needed; query all academy players
  const availableQuery = supabase
    .from("players")
    .select("id, full_name, position, date_of_birth, preferred_foot")
    .eq("academy_id", team.academy_id)
    .eq("active", true);

  const { data: available } = squadIds.length
    ? await availableQuery.not("id", "in", `(${squadIds.join(",")})`)
    : await availableQuery;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add player</h1>
        <p className="text-sm text-muted-foreground">Search your academy or create a new player.</p>
      </div>
      <AddPlayerTabs available={available ?? []} teamId={team.id} />
    </div>
  );
}
