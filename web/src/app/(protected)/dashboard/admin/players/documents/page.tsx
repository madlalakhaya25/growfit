import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOCUMENTS, isDocComplete } from "@/lib/document-definitions";
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
      id, full_name,
      team_members ( active, teams ( age_group ) )
    `)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("full_name");

  type TeamRow = { age_group: string | null };
  type MemberRow = { active: boolean; teams: TeamRow | TeamRow[] | null };
  type PlayerRow = { id: string; full_name: string; team_members: MemberRow[] | null };

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
  ).sort();

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
                      <ChaseMessageButton
                        message={
                          `Hi! Following up on ${player.full_name}'s registration with ${academy?.name ?? "the academy"} for the ${currentSeason} season — ` +
                          `we're still missing: ${outstanding.map((o) => o.def.label).join(", ")}. ` +
                          `Please let me know if you have any questions. Thank you!`
                        }
                      />
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
