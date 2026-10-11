import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PosterImport } from "@/components/fixtures/poster-import";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function PosterImportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ team?: string }>;
}>) {
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
  const backHref = `/dashboard/coach/fixtures?team=${team.id}`;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Fixtures
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Fixtures from a poster</h1>
        <p className="text-sm text-muted-foreground">
          {team.name}{team.age_group && ` · ${team.age_group}`}. Upcoming matches and results.
        </p>
      </div>
      <PosterImport teamId={team.id} backHref={backHref} />
    </div>
  );
}
