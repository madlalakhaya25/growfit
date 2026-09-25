import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PositionPieChart } from "@/components/analytics/position-pie-chart";
import { RatingTrendChart } from "@/components/analytics/rating-trend-chart";
import { ComplianceBar } from "@/components/analytics/compliance-bar";
import { AcademyHealthPanel } from "@/components/ai/academy-health-panel";
import { formatInTimezone } from "@/lib/time";

const DOC_TYPES = [
  "registration_agreement",
  "consent_form",
  "code_of_ethics",
  "medical_consent",
  "popia_consent",
  "id_document",
] as const;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) redirect("/auth/role");
  const academyId = profile.academy_id;
  const currentSeason = new Date().getFullYear().toString();

  const { data: activePlayerIds } = await supabase
    .from("players")
    .select("id")
    .eq("academy_id", academyId)
    .eq("active", true);

  const { data: sessionsData } = await supabase
    .from("training_sessions")
    .select("id, team_id, teams ( academy_id )");

  const academySessionIds = (sessionsData ?? [])
    .filter((s: { teams: { academy_id: string } | { academy_id: string }[] | null }) => {
      const t = Array.isArray(s.teams) ? s.teams[0] : s.teams;
      return t?.academy_id === academyId;
    })
    .map((s: { id: string }) => s.id);

  const [
    { data: playersRaw },
    { data: ratingsRaw },
    { data: documentsRaw },
    { data: trainingAttendanceRaw },
    { data: topRatingsRaw },
  ] = await Promise.all([
    supabase
      .from("players")
      .select("position")
      .eq("academy_id", academyId)
      .eq("active", true),
    supabase
      .from("player_ratings")
      .select("rating, created_at, fixtures ( team_id, teams ( academy_id ) )")
      // react-hooks/purity flags any impure call in a component body, but this
      // is a Server Component: it renders once, server-side, per request, with
      // no client-side reconciliation of this value to diverge from -- unlike a
      // Client Component (see new-session-form.tsx's real fix for that case),
      // there's no hydration pass here that could disagree with the server's
      // answer. The rule can't distinguish the two component kinds.
      // eslint-disable-next-line react-hooks/purity
      .gte("created_at", new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("player_documents")
      .select("player_id, document_type, status")
      .eq("season", currentSeason)
      .in("player_id", (activePlayerIds ?? []).map((p: { id: string }) => p.id)),
    academySessionIds.length
      ? supabase
          .from("training_attendance")
          .select("player_id, status, session_id, training_sessions ( team_id, teams ( academy_id, name ) )")
          .in("session_id", academySessionIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("player_ratings")
      .select("player_id, rating, players ( full_name, academy_id )")
      .in("player_id", (activePlayerIds ?? []).map((p: { id: string }) => p.id)),
  ]);

  // 1. Players by position
  const positionCounts: Record<string, number> = {};
  for (const p of (playersRaw ?? []) as { position: string | null }[]) {
    const pos = p.position ?? "unknown";
    positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
  }
  const positionData: { position: string; count: number }[] = Object.entries(positionCounts).map(([position, count]) => ({ position, count: count as number }));

  // 2. Average rating per month (last 6 months)
  type RatingRow = {
    rating: number;
    created_at: string;
    fixtures: { team_id: string; teams: { academy_id: string } | { academy_id: string }[] | null } | { team_id: string; teams: { academy_id: string } | { academy_id: string }[] | null }[] | null;
  };
  const academyRatings = (ratingsRaw as RatingRow[] ?? []).filter((r) => {
    const f = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
    if (!f) return false;
    const t = Array.isArray(f.teams) ? f.teams[0] : f.teams;
    return t?.academy_id === academyId;
  });

  const monthBuckets: Record<string, number[]> = {};
  for (const r of academyRatings) {
    const key = formatInTimezone(r.created_at, { month: "short", year: "2-digit" });
    (monthBuckets[key] ??= []).push(r.rating);
  }
  const ratingTrendData = Object.entries(monthBuckets)
    .slice(-6)
    .map(([month, vals]) => ({
      month,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));

  // 3. Document compliance
  type DocRow = { player_id: string; document_type: string; status: string };
  const totalPlayers = playersRaw?.length ?? 0;

  const playerDocMap = new Map<string, Set<string>>();
  for (const doc of (documentsRaw as DocRow[] ?? [])) {
    if (doc.status === "signed" || doc.status === "uploaded") {
      const set = playerDocMap.get(doc.player_id) ?? new Set();
      set.add(doc.document_type);
      playerDocMap.set(doc.player_id, set);
    }
  }
  let compliantCount = 0;
  for (const [, docs] of playerDocMap) {
    if (DOC_TYPES.every((t) => docs.has(t))) compliantCount++;
  }

  // 4. Training attendance per team
  type TrainingRow = {
    player_id: string;
    status: string;
    session_id: string;
    training_sessions: {
      team_id: string;
      teams: { academy_id: string; name: string } | { academy_id: string; name: string }[] | null;
    } | {
      team_id: string;
      teams: { academy_id: string; name: string } | { academy_id: string; name: string }[] | null;
    }[] | null;
  };

  const teamAttendance = new Map<string, { attending: number; total: number }>();
  for (const row of (trainingAttendanceRaw as TrainingRow[] ?? [])) {
    const session = Array.isArray(row.training_sessions) ? row.training_sessions[0] : row.training_sessions;
    if (!session) continue;
    const team = Array.isArray(session.teams) ? session.teams[0] : session.teams;
    if (!team) continue;
    const name = team.name;
    const cur = teamAttendance.get(name) ?? { attending: 0, total: 0 };
    cur.total++;
    if (row.status === "attending") cur.attending++;
    teamAttendance.set(name, cur);
  }
  const attendanceData = Array.from(teamAttendance.entries()).map(([team, { attending, total }]) => ({
    team,
    rate: total === 0 ? 0 : Math.round((attending / total) * 100),
    attending,
    total,
  }));

  // 5. Top 5 players by average rating
  type TopRatingRow = {
    player_id: string;
    rating: number;
    players: { full_name: string } | { full_name: string }[] | null;
  };
  const playerRatingsMap = new Map<string, { name: string; ratings: number[] }>();
  for (const row of (topRatingsRaw as TopRatingRow[] ?? [])) {
    const p = Array.isArray(row.players) ? row.players[0] : row.players;
    if (!p) continue;
    const cur = playerRatingsMap.get(row.player_id) ?? { name: p.full_name, ratings: [] };
    cur.ratings.push(row.rating);
    playerRatingsMap.set(row.player_id, cur);
  }
  const topPlayers = Array.from(playerRatingsMap.values())
    .map(({ name, ratings }) => ({ name, avg: ratings.reduce((a, b) => a + b, 0) / ratings.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Academy-wide statistics and trends</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Squad by Position */}
        <Card>
          <CardHeader>
            <CardTitle>Squad by Position</CardTitle>
            <CardDescription>Distribution of active players</CardDescription>
          </CardHeader>
          <CardContent>
            <PositionPieChart data={positionData} />
          </CardContent>
        </Card>

        {/* Rating Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Average Rating Trend</CardTitle>
            <CardDescription>Monthly average over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <RatingTrendChart data={ratingTrendData} />
          </CardContent>
        </Card>

        {/* Document Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Document Compliance</CardTitle>
            <CardDescription>{currentSeason} season — all 6 documents complete</CardDescription>
          </CardHeader>
          <CardContent>
            <ComplianceBar complete={compliantCount} total={totalPlayers} />
          </CardContent>
        </Card>

        {/* Training Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Training Attendance</CardTitle>
            <CardDescription>Attendance rate per team</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance data yet — coaches mark attendance in training sessions.</p>
            ) : (
              <div className="space-y-3">
                {attendanceData.map(({ team, rate, attending, total }) => (
                  <div key={team} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{team}</span>
                      <span className="tabular-nums text-muted-foreground">{attending}/{total} · {rate}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Rated Players */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Top Rated Players</CardTitle>
            <CardDescription>Top 5 by average match rating</CardDescription>
          </CardHeader>
          <CardContent>
            {topPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ratings logged yet — they appear once coaches log match results.</p>
            ) : (
              <ol className="divide-y divide-border">
                {topPlayers.map(({ name, avg }, i) => (
                  <li key={name} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">{name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {"★".repeat(Math.round(avg))}{"☆".repeat(5 - Math.round(avg))}
                    </span>
                    <span className="text-sm font-semibold tabular-nums w-8 text-right">{avg.toFixed(2)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <AcademyHealthPanel />
      </section>
    </div>
  );
}
