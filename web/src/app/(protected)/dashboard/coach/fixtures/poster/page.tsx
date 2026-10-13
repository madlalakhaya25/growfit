import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosterImport } from "@/components/fixtures/poster-import";
import { requireCoachTeams } from "@/lib/auth";

export default async function PosterImportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ team?: string }>;
}>) {
  const { team: teamParam } = await searchParams;
  const { allTeams } = await requireCoachTeams();

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
