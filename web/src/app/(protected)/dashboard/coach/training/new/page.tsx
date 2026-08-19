import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { NewSessionForm } from "./new-session-form";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function NewTrainingSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, age_group")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = allTeams.find((t) => t.id === teamParam) ?? allTeams[0];

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/coach/training?team=${team.id}`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Training
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold">New training session</h1>
        {allTeams.length > 1 && (
          <p className="text-sm text-muted-foreground mt-1">
            Team: <span className="font-medium">{team.name}</span>
          </p>
        )}
      </div>
      <NewSessionForm teamId={team.id} teams={allTeams} backHref={`/dashboard/coach/training?team=${team.id}`} />
    </div>
  );
}
