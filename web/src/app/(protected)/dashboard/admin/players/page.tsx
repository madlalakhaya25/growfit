import { Suspense } from "react";
import Link from "next/link";
import { Upload, CreditCard } from "lucide-react";
import { listUnassignedPlayers } from "@/app/actions/squad";
import { UnassignedPlayersPanel, type AssignTeam } from "@/components/records/unassigned-players-panel";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { POSITIONS } from "@/lib/types";
import { calculateAge, getInitials } from "@/lib/player";
import { AdminPlayerSearch } from "./admin-player-search";

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) redirect("/auth/role");

  let query = supabase
    .from("players")
    .select(`
      id, full_name, position, preferred_foot, date_of_birth, active,
      player_ratings ( rating )
    `)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("full_name");

  if (q) query = query.ilike("full_name", `%${q}%`);

  const { data: players } = await query;

  const currentSeason = new Date().getFullYear().toString();
  const playerIds = (players ?? []).map((p: { id: string }) => p.id);
  const { data: docRows } = playerIds.length
    ? await supabase
        .from("player_documents")
        .select("player_id, status")
        .in("player_id", playerIds)
        .eq("season", currentSeason)
    : { data: [] };

  const TOTAL_DOCS = 6;
  const docCountMap = new Map<string, number>();
  for (const row of docRows ?? []) {
    if (row.status === "signed" || row.status === "uploaded") {
      docCountMap.set(row.player_id, (docCountMap.get(row.player_id) ?? 0) + 1);
    }
  }

  const [{ players: unassigned }, { data: assignTeams }] = await Promise.all([
    listUnassignedPlayers(),
    supabase
      .from("teams")
      .select("id, name, age_group")
      .eq("academy_id", profile.academy_id)
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-sm text-muted-foreground">{players?.length ?? 0} active players</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/admin/players/new-card"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
          >
            <CreditCard className="size-4 text-primary" aria-hidden="true" />
            Create card
          </Link>
          <Link
            href="/dashboard/admin/players/import"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="size-4" aria-hidden="true" />
            Import players
          </Link>
        </div>
      </div>

      {(unassigned ?? []).length > 0 && (
        <UnassignedPlayersPanel
          players={unassigned ?? []}
          teams={(assignTeams ?? []) as AssignTeam[]}
        />
      )}

      <Suspense fallback={null}>
        <AdminPlayerSearch initialQ={q} />
      </Suspense>

      {(players ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No players found</CardTitle>
            <CardDescription>{q ? `No results for "${q}".` : "No players in the academy yet."}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {(players ?? []).map((p: {
            id: string; full_name: string; position: string | null;
            preferred_foot: string | null; date_of_birth: string | null;
            player_ratings: { rating: number }[];
          }) => {
            const ratings = p.player_ratings.map((r) => r.rating);
            const avg = ratings.length
              ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
              : null;
            const posLabel = POSITIONS.find((pos) => pos.value === p.position)?.label;
            const age = calculateAge(p.date_of_birth);
            const initials = getInitials(p.full_name);
            const docsComplete = docCountMap.get(p.id) ?? 0;
            const allDocsDone = docsComplete >= TOTAL_DOCS;

            return (
              <Link
                key={p.id}
                href={`/dashboard/admin/players/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-primary">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {posLabel && <Badge variant="neutral" className="text-xs">{posLabel}</Badge>}
                    {age && <Badge variant="neutral" className="text-xs">Age {age}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {avg && <span className="text-sm text-muted-foreground">★ {avg}</span>}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    allDocsDone
                      ? "bg-green-500/10 text-green-700"
                      : docsComplete > 0
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-secondary text-muted-foreground"
                  }`}>
                    {docsComplete}/{TOTAL_DOCS} docs
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
