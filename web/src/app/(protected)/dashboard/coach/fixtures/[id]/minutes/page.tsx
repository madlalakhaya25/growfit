import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { POSITIONS } from "@/lib/types";
import { defaultFormat } from "@/lib/playing-time";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MinutesPlanner, type PlannerPlayer } from "./minutes-planner";

type PlayerRow = { id: string; full_name: string; position: string | null };

const POSITION_ORDER = new Map(POSITIONS.map((p, i) => [p.value as string, i]));
const byPosition = (a: PlayerRow, b: PlayerRow) =>
  (POSITION_ORDER.get(a.position ?? "") ?? 99) - (POSITION_ORDER.get(b.position ?? "") ?? 99) ||
  a.full_name.localeCompare(b.full_name);

/** Who should be ticked by default: whoever was marked here, else everyone available. */
function defaultSelection(players: PlayerRow[], attendance: Map<string, string>, unavailable: Set<string>): string[] {
  const marked = players.filter((p) => attendance.has(p.id));
  if (marked.length > 0) {
    return marked.filter((p) => attendance.get(p.id) === "present" || attendance.get(p.id) === "late").map((p) => p.id);
  }
  return players.filter((p) => !unavailable.has(p.id)).map((p) => p.id);
}

export default async function FixtureMinutesPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id, opponent, team_id, is_home, teams ( age_group )")
    .eq("id", id)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
    .maybeSingle();
  if (!fixture) notFound();

  const [{ data: members }, { data: attendanceRows }] = await Promise.all([
    supabase.from("team_members").select("players ( id, full_name, position )").eq("team_id", fixture.team_id).eq("active", true),
    supabase.from("match_attendance").select("player_id, status").eq("fixture_id", id),
  ]);

  type MemberRow = { players: PlayerRow | PlayerRow[] | null };
  const players = ((members ?? []) as MemberRow[])
    .flatMap((m) => (Array.isArray(m.players) ? m.players : [m.players]))
    .filter((p): p is PlayerRow => !!p)
    .sort(byPosition);

  // Availability arrives with migration 039; without it nobody is marked unavailable.
  const unavailable = new Set<string>();
  if (players.length > 0) {
    const { data, error } = await supabase
      .from("players")
      .select("id, availability_status")
      .in("id", players.map((p) => p.id));
    if (!isMissingAttributeColumn(error)) {
      for (const row of (data ?? []) as { id: string; availability_status: string | null }[]) {
        if (row.availability_status && row.availability_status !== "available") unavailable.add(row.id);
      }
    }
  }

  const attendance = new Map(((attendanceRows ?? []) as { player_id: string; status: string }[]).map((r) => [r.player_id, r.status]));
  const team = Array.isArray(fixture.teams) ? fixture.teams[0] : fixture.teams;
  const format = defaultFormat((team as { age_group: string | null } | null)?.age_group);
  const plannerPlayers: PlannerPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.full_name,
    isKeeper: p.position === "gk",
    unavailable: unavailable.has(p.id),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/dashboard/coach/fixtures/${id}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Fixture
        </Link>
      </Button>
      <PageHeader
        title="Playing time"
        description={`${fixture.is_home ? "vs" : "@"} ${fixture.opponent} · fair minutes for everyone`}
      />
      {plannerPlayers.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          There are no players in this squad yet.
        </p>
      ) : (
        <MinutesPlanner
          fixtureId={id}
          players={plannerPlayers}
          defaultSelected={defaultSelection(players, attendance, unavailable)}
          defaultFormat={format}
        />
      )}
    </div>
  );
}
