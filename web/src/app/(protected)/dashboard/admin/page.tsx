import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Calendar, Star, ChevronRight, UserPlus, Settings, BarChart2 } from "lucide-react";

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

  const stats = [
    { label: "Active players",    value: players.count  ?? 0, Icon: Users,    href: "/dashboard/admin/players" },
    { label: "Teams",             value: teams.count    ?? 0, Icon: Shield,   href: "/dashboard/admin/teams" },
    { label: "Upcoming fixtures", value: fixtures.count ?? 0, Icon: Calendar, href: null },
    { label: "Ratings logged",    value: ratings.count  ?? 0, Icon: Star,     href: "/dashboard/admin/reports" },
  ];

  const quickActions = [
    { label: "Add player",       href: "/dashboard/admin/players",   Icon: UserPlus },
    { label: "Manage teams",     href: "/dashboard/admin/teams",     Icon: Shield },
    { label: "Academy settings", href: "/dashboard/admin/academy",   Icon: Settings },
    { label: "Analytics",        href: "/dashboard/admin/analytics", Icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Academy Overview</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, href }) => {
          const inner = (
            <Card className={href ? "transition-colors hover:border-primary/40 cursor-pointer" : undefined}>
              <CardHeader className="flex-row items-center gap-3 pb-2">
                <span className="grid size-9 place-items-center rounded-lg bg-brand/15 text-primary shrink-0">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <CardTitle className="text-sm font-medium text-muted-foreground flex-1 leading-tight">{label}</CardTitle>
                {href && <ChevronRight className="size-4 text-muted-foreground/40 shrink-0" aria-hidden="true" />}
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          );
          return href ? (
            <Link key={label} href={href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={label}>{inner}</div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick actions</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
