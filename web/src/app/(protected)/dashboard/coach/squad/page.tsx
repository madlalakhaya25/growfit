import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Upload, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RemovePlayerButton } from "./remove-player-button";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";
import { POSITIONS } from "@/lib/types";
import { calculateAge, getInitials } from "@/lib/player";
import { cn } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function SquadPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, age_group, invite_code")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = allTeams.find((t: { id: string; name: string; age_group: string | null; invite_code: string }) => t.id === teamParam) ?? allTeams[0];

  const { data: members } = await supabase
    .from("team_members")
    .select(`
      player_id, joined_at,
      players (
        id, full_name, position, preferred_foot, date_of_birth, photo_url,
        player_ratings ( rating )
      )
    `)
    .eq("team_id", team.id)
    .eq("active", true)
    .order("joined_at");

  const squad = (members ?? []).map((m: {
    player_id: string;
    joined_at: string;
    players: {
      id: string; full_name: string; position: string | null;
      preferred_foot: string | null; date_of_birth: string | null;
      photo_url: string | null; player_ratings: { rating: number }[];
    } | { id: string; full_name: string; position: string | null; preferred_foot: string | null; date_of_birth: string | null; photo_url: string | null; player_ratings: { rating: number }[] }[] | null;
  }) => {
    const p = Array.isArray(m.players) ? m.players[0] : m.players;
    if (!p) return null;
    const ratings = p.player_ratings.map((r) => r.rating);
    const avg = ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;
    const age = calculateAge(p.date_of_birth);
    return { ...p, avg, ratingsCount: ratings.length, age, joinedAt: m.joined_at };
  }).filter(Boolean);

  // Group by position group rather than the raw value. Players now carry
  // specific roles (cb, lb, cdm, …) as well as the five legacy ones, and
  // grouping on the raw value meant every specific role fell outside the
  // render order and simply never appeared.
  const byPosition: Record<string, typeof squad> = {};
  for (const p of squad) {
    const group = p?.position
      ? POSITIONS.find((x) => x.value === p.position)?.group ?? "Unassigned"
      : "Unassigned";
    if (!byPosition[group]) byPosition[group] = [];
    byPosition[group].push(p);
  }

  const posOrder = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Unassigned"];

  return (
    <div className="space-y-6">
      {allTeams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allTeams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/coach/squad?team=${t.id}`}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
                t.id === team.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {t.name} {t.age_group && `· ${t.age_group}`}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Squad</h1>
          <p className="text-sm text-muted-foreground">
            {team.name}{team.age_group && ` · ${team.age_group}`} · {squad.length} {squad.length === 1 ? "player" : "players"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <CopyInviteLinkButton inviteCode={team.invite_code} />
          <Button asChild variant="outline" className="shrink-0">
            <Link href={`/dashboard/coach/squad/import?team=${team.id}`}>
              <Upload className="size-4" aria-hidden="true" />
              Import
            </Link>
          </Button>
          <Button asChild className="shrink-0">
            <Link href={`/dashboard/coach/squad/add?team=${team.id}`}>
              <Plus className="size-4" aria-hidden="true" />
              Add player
            </Link>
          </Button>
        </div>
      </div>

      {squad.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No players yet</CardTitle>
            <CardDescription>Add your first player to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/dashboard/coach/squad/add?team=${team.id}`}>
                <Plus className="size-4" aria-hidden="true" />
                Add player
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {posOrder
            .filter((pos) => byPosition[pos]?.length)
            .map((pos) => (
              <section key={pos}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {pos} · {byPosition[pos].length}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {byPosition[pos].map((player) => {
                    if (!player) return null;
                    const initials = getInitials(player.full_name);
                    return (
                      <div
                        key={player.id}
                        className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                      >
                        {/* Avatar */}
                        <Link href={`/dashboard/coach/squad/${player.id}?team=${team.id}`} className="flex-shrink-0">
                          {player.photo_url ? (
                            <Image
                              src={player.photo_url}
                              alt={player.full_name}
                              width={48}
                              height={48}
                              className="size-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="grid size-12 place-items-center rounded-full bg-brand/20 text-sm font-bold text-primary">
                              {initials}
                            </span>
                          )}
                        </Link>

                        {/* Info */}
                        <Link href={`/dashboard/coach/squad/${player.id}?team=${team.id}`} className="min-w-0 flex-1">
                          <p className="truncate font-semibold leading-tight">{player.full_name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {player.age && (
                              <Badge variant="neutral" className="text-xs">Age {player.age}</Badge>
                            )}
                            {player.preferred_foot && (
                              <Badge variant="neutral" className="text-xs capitalize">
                                {player.preferred_foot}
                              </Badge>
                            )}
                          </div>
                          {player.avg && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              ★ {player.avg} avg · {player.ratingsCount}
                            </p>
                          )}
                        </Link>

                        {/* Remove */}
                        <RemovePlayerButton playerId={player.id} playerName={player.full_name} teamId={team.id} />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
