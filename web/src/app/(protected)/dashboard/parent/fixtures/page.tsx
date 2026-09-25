import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Calendar, LayoutGrid, List as ListIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { isFixturePast, fixtureStatusLabel, fixtureStatusVariant } from "@/lib/fixtures";
import { MonthCalendar, type CalendarEvent } from "@/components/calendar/month-calendar";
import { cn } from "@/lib/utils";
import { formatInTimezone, formatTime } from "@/lib/time";

export default async function ParentFixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { view: rawView, month: monthParam } = await searchParams;
  const view = rawView === "calendar" ? "calendar" : "list";
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
        .select("id, opponent, venue, fixture_date, is_home, status, cancellation_reason, team_id, teams ( name )")
        .in("team_id", teamIds)
        .order("fixture_date", { ascending: true })
    : { data: [] };

  // Training sessions, only for the calendar view — the list view above this
  // page has always been fixtures-only, and stays that way; the calendar is
  // the one place a parent sees both in one glance, matching what the .ics
  // feed already sends their calendar app (docs/BACKLOG.md 2.1).
  const { data: trainingSessions } = view === "calendar" && teamIds.length
    ? await supabase
        .from("training_sessions")
        .select("id, title, session_date, team_id")
        .in("team_id", teamIds)
    : { data: [] as { id: string; title: string; session_date: string; team_id: string }[] };

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
    fixture_date: string; is_home: boolean; status: string; cancellation_reason: string | null;
    team_id: string;
    teams: { name: string } | { name: string }[] | null;
  };

  const allFixtures = (fixtures ?? []) as Fixture[];
  const upcoming = allFixtures.filter((f) => !isFixturePast(f));
  const past     = allFixtures.filter((f) => isFixturePast(f));

  const now = new Date();
  const [calYear, calMonth] = monthParam?.match(/^\d{4}-\d{2}$/)
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const calendarEvents: CalendarEvent[] = [
    ...allFixtures.map((f) => ({
      id: `fixture-${f.id}`,
      date: f.fixture_date,
      title: `${f.is_home ? "vs" : "@"} ${f.opponent}`,
      kind: "fixture" as const,
    })),
    ...(trainingSessions ?? []).map((s) => ({
      id: `training-${s.id}`,
      date: s.session_date,
      title: s.title,
      kind: "training" as const,
    })),
  ];

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
          <Badge variant={fixtureStatusVariant(f)} className="shrink-0 capitalize">
            {fixtureStatusLabel(f)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" aria-hidden="true" />
            {formatInTimezone(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {formatTime(date)}
          </span>
          {f.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" aria-hidden="true" />
              {f.venue}
            </span>
          )}
        </div>
        {f.status === "cancelled" && f.cancellation_reason && (
          <p className="text-xs text-destructive">Cancelled: {f.cancellation_reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        {children.length > 0 && (
          <div className="flex rounded-lg border border-border p-0.5 text-sm">
            <Link
              href="/dashboard/parent/fixtures"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <ListIcon className="size-3.5" aria-hidden="true" />
              List
            </Link>
            <Link
              href="/dashboard/parent/fixtures?view=calendar"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" />
              Calendar
            </Link>
          </div>
        )}
      </div>

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
      ) : view === "calendar" ? (
        <div className="space-y-2">
          <MonthCalendar
            year={calYear}
            month={calMonth}
            events={calendarEvents}
            basePath="/dashboard/parent/fixtures"
            extraQuery={{ view: "calendar" }}
          />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              Fixture
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Training
            </span>
          </div>
        </div>
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
