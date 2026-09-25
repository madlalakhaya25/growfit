import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getTrainingAttendanceSummaries } from "@/lib/training-attendance";
import type { AttendanceSummary } from "@/lib/attendance";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { isFixturePast } from "@/lib/fixtures";
import { formatDayMonthYear } from "@/lib/time";
import { LogResultForm } from "./log-result-form";

export default async function LogResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id, opponent, fixture_date, is_home, status, team_id")
    .eq("id", id)
    .single();

  if (!fixture) notFound();
  // "upcoming" alone isn't enough -- that column stays "upcoming" for days
  // after a real kickoff since nothing flips it automatically, which let a
  // coach open this page and log a result for a fixture that hasn't been
  // played yet. isFixturePast is what actually knows whether kickoff has
  // passed; a result already logged (status no longer "upcoming") is
  // still redirected away as before.
  if (fixture.status !== "upcoming" || !isFixturePast(fixture)) redirect(`/dashboard/coach/fixtures/${id}`);

  const { data: members } = await supabase
    .from("team_members")
    .select("players ( id, full_name, position )")
    .eq("team_id", fixture.team_id)
    .eq("active", true);

  type PlayerRow = { id: string; full_name: string; position: string | null };
  const squad: PlayerRow[] = (members ?? []).flatMap((m: { players: PlayerRow | PlayerRow[] | null }) =>
    Array.isArray(m.players) ? m.players : m.players ? [m.players] : []
  );

  const attendanceByPlayer = await getTrainingAttendanceSummaries(
    supabase,
    fixture.team_id,
    squad.map((p) => p.id)
  );
  const trainingAttendance: Record<string, AttendanceSummary> = Object.fromEntries(attendanceByPlayer);

  // Queried separately, and tolerant of migration 039 not having run yet
  // (42703) — see squad-context.ts's own note on the same tradeoff. A
  // player with no row here reads as available, matching the column's
  // DEFAULT.
  const playerAvailability: Record<string, { status: string; note: string | null }> = {};
  const availability = await supabase
    .from("players")
    .select("id, availability_status, availability_note")
    .in("id", squad.map((p) => p.id));
  if (!isMissingAttributeColumn(availability.error)) {
    for (const row of (availability.data ?? []) as { id: string; availability_status: string; availability_note: string | null }[]) {
      if (row.availability_status !== "available") {
        playerAvailability[row.id] = { status: row.availability_status, note: row.availability_note };
      }
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/dashboard/coach/fixtures/${id}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Fixture
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Log result</h1>
        <p className="text-sm text-muted-foreground">
          {fixture.is_home ? "vs" : "@"} {fixture.opponent} ·{" "}
          {formatDayMonthYear(fixture.fixture_date)}
        </p>
      </div>
      <LogResultForm
        fixtureId={id}
        squad={squad}
        isHome={fixture.is_home}
        opponent={fixture.opponent}
        trainingAttendance={trainingAttendance}
        playerAvailability={playerAvailability}
      />
    </div>
  );
}
