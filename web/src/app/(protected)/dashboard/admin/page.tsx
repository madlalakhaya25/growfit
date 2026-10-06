import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { ListRow, ListRowGroup, GroupedSection } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { Users, Shield, Calendar, Star, UserPlus, Settings, BarChart2, FileCheck2, HeartPulse } from "lucide-react";
import { reportError } from "@/lib/report-error";
import { DOCUMENTS } from "@/lib/document-definitions";
import { loadAdminToday, type AdminTodayRows } from "@/lib/admin-today-data";
import { formatWeekdayDayMonth } from "@/lib/time";
import { adminCardsFor } from "@/lib/staff-hats";
import { loadOwnHats } from "@/lib/staff-hats-data";

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
  // No hats (or migration 069 not run) shows every card, as before hats existed.
  const cards = adminCardsFor(await loadOwnHats(supabase, user.id));

  const season = new Date().getFullYear().toString();
  const [players, teams, fixtures, ratings, members, docRows] = await Promise.all([
    supabase.from("players").select("id", { count: "exact" }).eq("academy_id", academyId).eq("active", true),
    supabase.from("teams").select("id", { count: "exact" }).eq("academy_id", academyId).eq("active", true),
    supabase.from("fixtures").select("id", { count: "exact" }).eq("status", "upcoming").gte("fixture_date", new Date().toISOString()),
    supabase.from("player_ratings").select("id", { count: "exact" }),
    supabase.from("team_members").select("player_id, team_id, players!inner(academy_id, active)").eq("active", true).eq("players.academy_id", academyId).eq("players.active", true),
    supabase.from("player_documents").select("player_id, document_type, status").eq("season", season),
  ]);

  // A failed count and a genuine zero must not render the same way — "0
  // active players" reads as a real, alarming fact, not as "couldn't load".
  for (const [query, result] of [
    ["players", players],
    ["teams", teams],
    ["fixtures", fixtures],
    ["ratings", ratings],
    ["team members", members],
    ["documents", docRows],
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

  // Registration health: the six documents per player, rolled up per team. A
  // failed load shows "couldn't check", never a reassuring 100%.
  const complianceLoaded = !players.error && !teams.error && !members.error && !docRows.error;
  const today = complianceLoaded
    ? await loadAdminToday(supabase, academyId, {
        members: (members.data ?? []) as AdminTodayRows["members"],
        docs: (docRows.data ?? []) as AdminTodayRows["docs"],
      })
    : null;
  const compliance = today?.compliance ?? null;
  const welfareCount = today?.welfareCount ?? null;

  const quickActions = [
    { label: "Add player",       href: "/dashboard/admin/players",   Icon: UserPlus },
    { label: "Manage teams",     href: "/dashboard/admin/teams",     Icon: Shield },
    { label: "Academy settings", href: "/dashboard/admin/academy",   Icon: Settings },
    { label: "Analytics",        href: "/dashboard/admin/analytics", Icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Today" eyebrow={formatWeekdayDayMonth(new Date())} />

      {cards.includes("registration") && <RegistrationHero compliance={compliance} />}
      <NeedsYou
        compliance={cards.includes("registration") ? compliance : null}
        welfareCount={cards.includes("welfare") ? welfareCount : null}
      />

      {/* Stat tiles */}
      {cards.includes("stats") && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, href }) =>
          href ? (
            <Link key={label} href={href} className="block">
              <StatTile label={label} value={value} icon={Icon} className="transition-colors hover:border-primary/40" />
            </Link>
          ) : (
            <StatTile key={label} label={label} value={value} icon={Icon} />
          )
        )}
      </div>}

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

type Compliance = Awaited<ReturnType<typeof loadAdminToday>>["compliance"] | null;

function RegistrationHero({ compliance }: Readonly<{ compliance: Compliance }>) {
  if (!compliance) {
    return (
      <Card className="border-destructive/50 p-4 text-sm">
        Couldn&apos;t check registration right now. This isn&apos;t the same as everyone being registered. Try reloading.
      </Card>
    );
  }
  return (
    <Link
      href="/dashboard/admin/players/documents"
      className="block rounded-2xl bg-[#a71817] p-5 text-white shadow-[0_12px_28px_rgb(167_24_23/0.25)] transition-transform duration-200 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-white/90">Registration this season</p>
        <span className="grid size-9 place-items-center rounded-full bg-white/15">
          <FileCheck2 className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1.5 text-[34px] font-bold leading-tight tracking-[-0.02em] tabular-nums">{compliance.pct}%</p>
      <p className="mt-1 text-[15px] text-white/90">
        {compliance.complete} of {compliance.players} players have all {DOCUMENTS.length} documents in
      </p>
    </Link>
  );
}

function documentsHref(ageGroup: string | null): string {
  const base = "/dashboard/admin/players/documents";
  return ageGroup ? `${base}?age=${encodeURIComponent(ageGroup)}` : base;
}

function NeedsYou({ compliance, welfareCount }: Readonly<{ compliance: Compliance; welfareCount: number | null }>) {
  const gaps = (compliance?.byTeam ?? []).filter((t) => t.missingDocs > 0);
  const welfare = welfareCount ?? 0;
  if (gaps.length === 0 && welfare === 0) return null;
  return (
    <GroupedSection title="Needs you">
      {gaps.map((t) => (
        <ListRow
          key={t.teamId}
          leading={<IconTile tone="orange"><FileCheck2 aria-hidden="true" /></IconTile>}
          title={`${t.name}: ${t.missingDocs} ${t.missingDocs === 1 ? "document" : "documents"} missing`}
          subtitle={`${t.complete} of ${t.players} players fully registered`}
          href={documentsHref(t.ageGroup)}
        />
      ))}
      {welfare > 0 && (
        <ListRow
          leading={<IconTile tone="red"><HeartPulse aria-hidden="true" /></IconTile>}
          title={`${welfare} ${welfare === 1 ? "player" : "players"} below 75% attendance`}
          subtitle="Welfare check-in due, your coaches see these on their Today page"
        />
      )}
    </GroupedSection>
  );
}
