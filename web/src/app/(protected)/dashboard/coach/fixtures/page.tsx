import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isFixturePast, fixtureStatusLabel, fixtureStatusVariant } from "@/lib/fixtures";

export default async function CoachFixturesPage({
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

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, opponent, venue, fixture_date, is_home, status, cancellation_reason")
    .eq("team_id", team.id)
    .order("fixture_date", { ascending: false });

  const upcoming = (fixtures ?? []).filter((f) => !isFixturePast(f));
  const past = (fixtures ?? []).filter((f) => isFixturePast(f));

  function FixtureRow({ f }: { f: { id: string; opponent: string; venue: string | null; fixture_date: string; is_home: boolean; status: string } }) {
    const date = new Date(f.fixture_date);
    return (
      <Link
        href={`/dashboard/coach/fixtures/${f.id}`}
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0">
          <p className="font-medium">
            {f.is_home ? "vs" : "@"} {f.opponent}
          </p>
          <p className="text-xs text-muted-foreground">
            {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            {f.venue && ` · ${f.venue}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0">
            {f.is_home ? "Home" : "Away"}
          </Badge>
          <Badge variant={fixtureStatusVariant(f)} className="capitalize shrink-0">
            {fixtureStatusLabel(f)}
          </Badge>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      {allTeams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allTeams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/coach/fixtures?team=${t.id}`}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
                t.id === team.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {t.name} {t.age_group && `· ${t.age_group}`}
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <Button asChild>
          <Link href={`/dashboard/coach/fixtures/new?team=${team.id}`}>
            <Plus className="size-4" aria-hidden="true" />
            New fixture
          </Link>
        </Button>
      </div>

      {(fixtures ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No fixtures yet</CardTitle>
            <CardDescription>Schedule your first match to track results and player appearances.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/dashboard/coach/fixtures/new?team=${team.id}`}>
                <Plus className="size-4" aria-hidden="true" />
                Schedule first match
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Upcoming · {upcoming.length}
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {upcoming.map((f: { id: string; opponent: string; venue: string | null; fixture_date: string; is_home: boolean; status: string }) => <FixtureRow key={f.id} f={f} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Past · {past.length}
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {past.map((f: { id: string; opponent: string; venue: string | null; fixture_date: string; is_home: boolean; status: string }) => <FixtureRow key={f.id} f={f} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
