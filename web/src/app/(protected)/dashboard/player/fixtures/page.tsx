import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isFixturePast } from "@/lib/fixtures";

const STATUS_VARIANT = {
  upcoming:  "neutral",
  completed: "success",
  cancelled: "danger",
  postponed: "warning",
} as const;

export default async function PlayerFixturesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!player) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <p className="text-muted-foreground">No player profile found. Ask your coach to add you to the squad.</p>
      </div>
    );
  }

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("team_id, teams ( name, age_group )")
    .eq("player_id", player.id)
    .eq("active", true);

  const teamIds = (memberRows ?? []).map((m: { team_id: string }) => m.team_id);
  const teamMap = new Map(
    (memberRows ?? []).map((m: { team_id: string; teams: { name: string; age_group: string | null } | { name: string; age_group: string | null }[] | null }) => [
      m.team_id,
      Array.isArray(m.teams) ? m.teams[0] : m.teams,
    ])
  );

  if (!teamIds.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <p className="text-muted-foreground">You&apos;re not in a team yet. Ask your coach for the team invite code.</p>
      </div>
    );
  }

  // Fetch all team fixtures + this player's appearances separately to avoid
  // the INNER JOIN problem (upcoming fixtures have no match_appearances yet)
  const [{ data: fixtures }, { data: appearances }] = await Promise.all([
    supabase
      .from("fixtures")
      .select(`
        id, team_id, opponent, venue, fixture_date, is_home, status,
        match_results ( team_score, opponent_score )
      `)
      .in("team_id", teamIds)
      .order("fixture_date", { ascending: false }),
    supabase
      .from("match_appearances")
      .select("fixture_id, played")
      .eq("player_id", player.id),
  ]);

  // Build a lookup map: fixture_id → appearance
  const appearanceMap = new Map(
    (appearances ?? []).map((a: { fixture_id: string; played: boolean }) => [a.fixture_id, a])
  );

  const allFixtures = fixtures ?? [];
  const upcoming = allFixtures.filter((f) => !isFixturePast(f));
  const past     = allFixtures.filter((f) => isFixturePast(f));

  type Fixture = (typeof allFixtures)[number];

  function FixtureRow({ f }: { f: Fixture }) {
    const date   = new Date(f.fixture_date);
    const result = Array.isArray(f.match_results) ? f.match_results[0] : f.match_results;
    const appearance = appearanceMap.get(f.id);
    const teamInfo = teamMap.get(f.team_id) as { name: string; age_group: string | null } | null | undefined;

    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium">{f.is_home ? "vs" : "@"} {f.opponent}</p>
          <p className="text-xs text-muted-foreground">
            {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
            {f.venue && ` · ${f.venue}`}
          </p>
          {teamIds.length > 1 && teamInfo && (
            <span className="text-xs text-muted-foreground">{teamInfo.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result && (() => {
            const ourScore = f.is_home ? result.team_score : result.opponent_score;
            const theirScore = f.is_home ? result.opponent_score : result.team_score;
            const outcome = ourScore > theirScore ? "W" : ourScore < theirScore ? "L" : "D";
            const outcomeVariant = outcome === "W" ? "success" : outcome === "L" ? "danger" : "neutral";
            return (
              <>
                <Badge variant={outcomeVariant as "success" | "danger" | "neutral"} className="font-bold">
                  {outcome}
                </Badge>
                <span className="font-bold tabular-nums text-sm">
                  {ourScore} – {theirScore}
                </span>
              </>
            );
          })()}
          {appearance && (
            <Badge variant={appearance.played ? "success" : "neutral"}>
              {appearance.played ? "Played" : "Absent"}
            </Badge>
          )}
          <Badge
            variant={STATUS_VARIANT[f.status as keyof typeof STATUS_VARIANT] ?? "neutral"}
            className="capitalize"
          >
            {f.status}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Fixtures</h1>

      {allFixtures.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No fixtures yet</CardTitle>
            <CardDescription>Your upcoming matches will appear here once scheduled.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Upcoming · {upcoming.length}
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {upcoming.map((f) => <FixtureRow key={f.id} f={f} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Past · {past.length}
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {past.map((f) => <FixtureRow key={f.id} f={f} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
