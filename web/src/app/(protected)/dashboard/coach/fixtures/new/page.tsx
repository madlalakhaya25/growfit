import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewFixtureForm } from "./new-fixture-form";
import { requireCoachTeams } from "@/lib/auth";

export default async function NewFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const { allTeams } = await requireCoachTeams();

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
