import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { NewFixtureForm } from "./new-fixture-form";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function NewFixturePage({
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
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/coach/fixtures?team=${team.id}`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Fixtures
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">New fixture</h1>
        <p className="text-sm text-muted-foreground">
          {team.name}{team.age_group && ` · ${team.age_group}`}
        </p>
      </div>
      <NewFixtureForm teamId={team.id} backHref={`/dashboard/coach/fixtures?team=${team.id}`} />
    </div>
  );
}
