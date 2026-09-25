import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { Users, Shield, Calendar, Star, UserPlus, Settings, BarChart2 } from "lucide-react";
import { reportError } from "@/lib/report-error";

export default async function AdminDashboardPage() {
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

  const [players, teams, fixtures, ratings] = await Promise.all([
    supabase.from("players").select("id", { count: "exact" }).eq("academy_id", academyId).eq("active", true),
    supabase.from("teams").select("id", { count: "exact" }).eq("academy_id", academyId).eq("active", true),
    supabase.from("fixtures").select("id", { count: "exact" }).eq("status", "upcoming").gte("fixture_date", new Date().toISOString()),
    supabase.from("player_ratings").select("id", { count: "exact" }),
  ]);

  // A failed count and a genuine zero must not render the same way — "0
  // active players" reads as a real, alarming fact, not as "couldn't load".
  for (const [query, result] of [
    ["players", players],
    ["teams", teams],
    ["fixtures", fixtures],
    ["ratings", ratings],
  ] as const) {
    if (result.error) {
      reportError(result.error, { scope: "admin overview", extra: { query } });
    }
  }

  const stats = [
    { label: "Active players",    value: players.error  ? null : players.count  ?? 0, Icon: Users,    href: "/dashboard/admin/players" },
    { label: "Teams",             value: teams.error    ? null : teams.count    ?? 0, Icon: Shield,   href: "/dashboard/admin/teams" },
    { label: "Upcoming fixtures", value: fixtures.error ? null : fixtures.count ?? 0, Icon: Calendar, href: null },
    { label: "Ratings logged",    value: ratings.error  ? null : ratings.count  ?? 0, Icon: Star,     href: "/dashboard/admin/reports" },
  ];

  const quickActions = [
    { label: "Add player",       href: "/dashboard/admin/players",   Icon: UserPlus },
    { label: "Manage teams",     href: "/dashboard/admin/teams",     Icon: Shield },
    { label: "Academy settings", href: "/dashboard/admin/academy",   Icon: Settings },
    { label: "Analytics",        href: "/dashboard/admin/analytics", Icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Academy Overview" />

      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, href }) =>
          href ? (
            <Link key={label} href={href} className="block">
              <StatTile label={label} value={value} icon={Icon} className="transition-colors hover:border-primary/40" />
            </Link>
          ) : (
            <StatTile key={label} label={label} value={value} icon={Icon} />
          )
        )}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick actions</p>
        <Card>
          <ListRowGroup className="px-4">
            {quickActions.map(({ label, href, Icon }) => (
              <ListRow
                key={label}
                leading={<Icon className="size-5 text-primary" aria-hidden="true" />}
                title={label}
                href={href}
              />
            ))}
          </ListRowGroup>
        </Card>
      </div>
    </div>
  );
}
