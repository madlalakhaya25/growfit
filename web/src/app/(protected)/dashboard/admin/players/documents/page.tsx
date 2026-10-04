import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOCUMENTS, isDocComplete } from "@/lib/document-definitions";
import { buildChase, type ChaseReason } from "@/lib/compliance-chase";
import { flagAgeEligibility, findDuplicates } from "@/lib/eligibility";
import { ChaseMessageButton } from "@/components/records/chase-message-button";

/**
 * Registration document funnel (docs/BACKLOG.md 2.2).
 *
 * Rows are players, columns are the six required documents, filterable by
 * age group — the shape a compliance officer actually works from, not a
 * per-player checklist opened one child at a time. `/api/reports/compliance`
 * already exports the same underlying data as CSV/PDF for record-keeping;
 * this is the working view for chasing the gap before Sunday.
 */
export default async function DocumentFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ age?: string }>;
}) {
  const { age } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");
  if (!profile.academy_id) redirect("/auth/role");

  const { data: academy } = await supabase
    .from("academies")
    .select("name")
    .eq("id", profile.academy_id)
    .single();

  const { data: players } = await supabase
    .from("players")
    .select(`
      id, full_name, date_of_birth, id_number, mysafa_number,
      team_members ( active, team_id, teams ( age_group ) )
    `)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("full_name");

  type TeamRow = { age_group: string | null };
  type MemberRow = { active: boolean; team_id: string; teams: TeamRow | TeamRow[] | null };
  type PlayerRow = {
    id: string; full_name: string; date_of_birth: string | null; id_number: string | null; mysafa_number: string | null;
    team_members: MemberRow[] | null;
  };

  const allPlayers = (players ?? []) as unknown as PlayerRow[];
  const ageGroupOf = (p: PlayerRow): string | null => {
    for (const m of p.team_members ?? []) {
      if (!m.active) continue;
      const t = Array.isArray(m.teams) ? m.teams[0] : m.teams;
      if (t?.age_group) return t.age_group;
    }
    return null;
  };

  const ageGroups = Array.from(
    new Set(allPlayers.map(ageGroupOf).filter((g): g is string => g !== null))
  ).sort((a, b) => a.localeCompare(b));

  const visiblePlayers = age ? allPlayers.filter((p) => ageGroupOf(p) === age) : allPlayers;
  const playerIds = visiblePlayers.map((p) => p.id);

  const currentSeason = new Date().getFullYear().toString();
  const { data: docRows } = playerIds.length
    ? await supabase
        .from("player_documents")
        .select("player_id, document_type, status")
        .in("player_id", playerIds)
        .eq("season", currentSeason)
    : { data: [] as { player_id: string; document_type: string; status: string }[] };

  const statusByPlayerDoc = new Map<string, string>();
  for (const row of docRows ?? []) {
    statusByPlayerDoc.set(`${row.player_id}:${row.document_type}`, row.status);
  }

  // This week's chase. Teams' next kick-offs inside the week make a gap urgent.
  const now = new Date();
  const { data: fixtureRows } = await supabase
    .from("fixtures")
    .select("team_id, fixture_date")
    .eq("status", "upcoming")
    .gte("fixture_date", now.toISOString())
    .order("fixture_date");
  const nextByTeam = new Map<string, string>();
  for (const f of (fixtureRows ?? []) as { team_id: string; fixture_date: string }[]) {
    if (!nextByTeam.has(f.team_id)) nextByTeam.set(f.team_id, f.fixture_date);
  }
  const activeTeamOf = (p: PlayerRow) => (p.team_members ?? []).find((m) => m.active)?.team_id ?? null;
  const flags = {
    overage: new Set(flagAgeEligibility(allPlayers.map((p) => ({ ...p, age_group: ageGroupOf(p) }))).map((f) => f.playerId)),
    duplicate: new Set(findDuplicates(allPlayers.map((p) => ({ ...p, mysafa_number: p.mysafa_number }))).flatMap((g) => g.players.map((x) => x.id))),
  };
  const chase = buildChase(
    visiblePlayers.map((p) => ({
      id: p.id,
      name: p.full_name,
      ageGroup: ageGroupOf(p),
      safaNumber: p.mysafa_number,
      docStatus: new Map(
        DOCUMENTS.flatMap((d) => {
          const st = statusByPlayerDoc.get(`${p.id}:${d.type}`);
          return st ? [[d.type, st] as [string, string]] : [];
        }),
      ),
      nextFixture: nextByTeam.get(activeTeamOf(p) ?? "") ?? null,
    })),
    flags,
    academy?.name ?? "the academy",
    currentSeason,
    now,
  );
  const messageFor = new Map(chase.map((c) => [c.playerId, c.message]));

  const rows = visiblePlayers.map((p) => {
    const cells = DOCUMENTS.map((def) => {
      const status = statusByPlayerDoc.get(`${p.id}:${def.type}`);
      return { def, status, complete: isDocComplete(def, status) };
    });
    const outstanding = cells.filter((c) => !c.complete);
    return { player: p, ageGroup: ageGroupOf(p), cells, outstanding };
  });

  const fullyCompliant = rows.filter((r) => r.outstanding.length === 0).length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/admin/players">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Players
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Registration documents</h1>
        <p className="text-sm text-muted-foreground">
          {fullyCompliant} of {rows.length} player{rows.length === 1 ? "" : "s"} fully compliant for {currentSeason}
          {age ? ` · ${age}` : ""}.
        </p>
      </div>

      <ThisWeek chase={chase} />

      {ageGroups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/dashboard/admin/players/documents"
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !age ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            All age groups
          </Link>
          {ageGroups.map((g) => (
            <Link
              key={g}
              href={`/dashboard/admin/players/documents?age=${encodeURIComponent(g)}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                age === g ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {g}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players to show.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 bg-muted/40 px-4 py-2.5">Player</th>
                {DOCUMENTS.map((def) => (
                  <th key={def.type} className="px-3 py-2.5 text-center font-semibold" title={def.label}>
                    {def.form}
                  </th>
                ))}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ player, cells, outstanding }) => (
                <tr key={player.id} className={outstanding.length === 0 ? undefined : "bg-amber-500/[0.03]"}>
                  <td className="sticky left-0 bg-card px-4 py-2.5 font-medium">
                    <Link href={`/dashboard/admin/players/${player.id}`} className="hover:underline">
                      {player.full_name}
                    </Link>
                  </td>
                  {cells.map(({ def, complete, status }) => (
                    <td key={def.type} className="px-3 py-2.5 text-center" title={`${def.label}${status ? ` — ${status}` : " — not started"}`}>
                      {complete ? (
                        <CheckCircle2 className="mx-auto size-4 text-green-500" aria-label={`${def.label}: complete`} />
                      ) : status === "needs_renewal" ? (
                        <AlertCircle className="mx-auto size-4 text-amber-500" aria-label={`${def.label}: needs renewal`} />
                      ) : (
                        <Circle className="mx-auto size-3.5 text-muted-foreground/30" aria-label={`${def.label}: outstanding`} />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    {outstanding.length > 0 && (
                      <ChaseMessageButton message={messageFor.get(player.id) ?? ""} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const REASON_LABEL: Record<ChaseReason, string> = {
  "no-safa": "No SAFA number",
  documents: "Documents missing",
  age: "Check age band",
  duplicate: "Possible duplicate",
};

/** The short list to work through before Sunday, most urgent first. */
function ThisWeek({ chase }: Readonly<{ chase: ReturnType<typeof buildChase> }>) {
  if (chase.length === 0) {
    return <p className="rounded-xl border border-border bg-card p-4 text-sm">Nobody needs chasing this week.</p>;
  }
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4" aria-label="This week's chase">
      <h2 className="text-sm font-semibold">Chase this week ({chase.length})</h2>
      <p className="text-xs text-muted-foreground">
        Most urgent first. Players with a match in the next seven days and a gap come to the top. Messages are copied, never sent.
      </p>
      <ul className="divide-y divide-border">
        {chase.slice(0, 12).map((c) => (
          <li key={c.playerId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <Link href={`/dashboard/admin/players/${c.playerId}`} className="text-sm font-medium hover:underline">{c.name}</Link>
              {c.ageGroup && <span className="ml-1.5 text-xs text-muted-foreground">{c.ageGroup}</span>}
              <div className="mt-0.5 flex flex-wrap gap-1">
                {c.fixtureInDays !== null && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                    {c.fixtureInDays <= 1 ? "Plays tomorrow" : `Plays in ${c.fixtureInDays} days`}
                  </span>
                )}
                {c.reasons.map((r) => (
                  <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{REASON_LABEL[r]}</span>
                ))}
              </div>
            </div>
            {c.message && <ChaseMessageButton message={c.message} />}
          </li>
        ))}
      </ul>
      {chase.length > 12 && <p className="text-xs text-muted-foreground">And {chase.length - 12} more in the table below.</p>}
    </section>
  );
}
