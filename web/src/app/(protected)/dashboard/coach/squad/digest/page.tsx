import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentTeamFromCookies } from "@/lib/current-team-server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { loadWeekDigests } from "@/lib/family-messages";
import { todayIso } from "@/lib/time";
import { weekKeyFor } from "@/lib/weekly-digest";
import { WeeklyDigestPanel } from "@/components/development/weekly-digest-panel";
import type { StoryRow } from "@/components/fixtures/match-stories-panel";

export default async function WeeklyDigestPage({ searchParams }: Readonly<{ searchParams: Promise<{ team?: string }> }>) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams").select("id, name, age_group").in("id", await getCoachedTeamIds(supabase, user.id)).eq("active", true).order("created_at");
  if (!allTeams?.length) redirect("/dashboard/coach");
  const team = (await resolveCurrentTeamFromCookies(allTeams, teamParam)) ?? allTeams[0];

  const { data: members } = await supabase.from("team_members").select("players ( id, full_name )").eq("team_id", team.id).eq("active", true);
  type Person = { id: string; full_name: string };
  const roster = ((members ?? []) as unknown as { players: Person | Person[] | null }[])
    .flatMap((m) => [m.players ?? []].flat())
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id));

  const weekKey = weekKeyFor(todayIso());
  const { available, byPlayer } = await loadWeekDigests(supabase, roster.map((p) => p.id), weekKey);
  const rows: StoryRow[] = roster.map((p) => {
    const m = byPlayer.get(p.id);
    return {
      playerId: p.id, name: p.full_name,
      message: m ? { id: m.id, body: m.body, status: m.status, approvedByName: m.approvedByName } : null,
    };
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/coach/squad" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Squad
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Weekly notes: {team.name}</h1>
      </div>
      <WeeklyDigestPanel
        key={rows.map((r) => `${r.message?.id}${r.message?.status}`).join()}
        teamId={team.id} rows={rows} available={available}
      />
    </div>
  );
}
