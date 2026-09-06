import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { isFixturePast } from "@/lib/fixtures";

const STATUS_VARIANT = {
  upcoming:  "neutral",
  completed: "success",
  cancelled: "danger",
  postponed: "warning",
} as const;

export default async function ParentFixturesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Get all players linked to this parent
  const { data: links } = await supabase
    .from("parent_player_links")
    .select("players ( id, full_name, team_members ( team_id, active ) )")
    .eq("parent_id", user.id);

  type ChildPlayer = {
    id: string;
    full_name: string;
    team_members: { team_id: string; active: boolean }[];
  };

  const children = (links ?? []).flatMap((l: { players: ChildPlayer | ChildPlayer[] | null }) => {
    if (!l.players) return [];
    return Array.isArray(l.players) ? l.players : [l.players];
  });

  // Collect all active team IDs across all children
  const teamIds = [
    ...new Set(
      children.flatMap((c) =>
        (c.team_members ?? []).filter((m) => m.active).map((m) => m.team_id)
      )
    ),
  ];

  const { data: fixtures } = teamIds.length
    ? await supabase
        .from("fixtures")
        .select("id, opponent, venue, fixture_date, is_home, status, team_id, teams ( name )")
        .in("team_id", teamIds)
        .order("fixture_date", { ascending: true })
    : { data: [] };

  // Build a map: team_id → child names (a team may have multiple linked children)
  const teamChildNames: Record<string, string[]> = {};
  for (const child of children) {
    for (const m of child.team_members ?? []) {
      if (!m.active) continue;
      if (!teamChildNames[m.team_id]) teamChildNames[m.team_id] = [];
      teamChildNames[m.team_id].push(child.full_name);
    }
  }

  type Fixture = {
    id: string; opponent: string; venue: string | null;
    fixture_date: string; is_home: boolean; status: string;
    team_id: string;
    teams: { name: string } | { name: string }[] | null;
  };

  const allFixtures = (fixtures ?? []) as Fixture[];
  const upcoming = allFixtures.filter((f) => !isFixturePast(f));
  const past     = allFixtures.filter((f) => isFixturePast(f));

  function FixtureRow({ f }: { f: Fixture }) {
    const teamName = Array.isArray(f.teams) ? f.teams[0]?.name : f.teams?.name;
    const childNames = teamChildNames[f.team_id] ?? [];
    const date = new Date(f.fixture_date);
    return (
      <div className="px-4 py-3 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium truncate">
              {f.is_home ? "vs" : "@"} {f.opponent}
            </p>
            <p className="text-xs text-muted-foreground">
              {teamName}{childNames.length > 0 ? ` · ${childNames.join(", ")}` : ""}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[f.status as keyof typeof STATUS_VARIANT] ?? "neutral"} className="shrink-0 capitalize">
            {f.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" aria-hidden="true" />
            {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {f.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {f.venue}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fixtures</h1>

      {children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No children linked</CardTitle>
            <CardDescription>
              Link your child&apos;s profile from{" "}
              <Link href="/dashboard/parent" className="text-primary underline-offset-4 hover:underline">
                My Children
              </Link>{" "}
              to see their fixtures here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : allFixtures.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No fixtures yet</CardTitle>
            <CardDescription>Fixtures will appear here once your child&apos;s coach schedules them.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Upcoming</p>
              <div className="divide-y divide-border rounded-xl border border-border bg-card">
                {upcoming.map((f) => <FixtureRow key={f.id} f={f} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Past</p>
              <div className="divide-y divide-border rounded-xl border border-border bg-card">
                {past.map((f) => <FixtureRow key={f.id} f={f} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
