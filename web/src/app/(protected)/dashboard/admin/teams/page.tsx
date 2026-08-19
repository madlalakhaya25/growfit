import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users } from "lucide-react";
import { CoachCodeBlock, RemoveCoachButton } from "./coach-code-controls";
import { TeamActions } from "./team-actions";

export default async function AdminTeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id) redirect("/auth/role");

  // Core query deliberately excludes coach_code and team_coaches: both arrive
  // with migration 019, and asking for a column that does not exist fails the
  // whole query — which used to render as "No teams yet" rather than an error.
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select(`
      id, name, age_group, invite_code, coach_id, active, created_at,
      team_members ( player_id, active )
    `)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("name");

  // Best effort: coach codes and the coaching roster. Missing before 019.
  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
  const [{ data: codeRows }, { data: rosterRows }] = teamIds.length
    ? await Promise.all([
        supabase.from("teams").select("id, coach_code").in("id", teamIds),
        supabase
          .from("team_coaches")
          .select("team_id, coach_id, is_head, profiles ( full_name )")
          .in("team_id", teamIds),
      ])
    : [{ data: null }, { data: null }];

  const coachCodeById = new Map(
    ((codeRows ?? []) as { id: string; coach_code: string | null }[]).map((r) => [r.id, r.coach_code])
  );
  const rosterByTeam = new Map<string, { id: string; name: string; isHead: boolean }[]>();
  for (const r of (rosterRows ?? []) as {
    team_id: string; coach_id: string; is_head: boolean;
    profiles: { full_name: string } | { full_name: string }[] | null;
  }[]) {
    const pr = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const list = rosterByTeam.get(r.team_id) ?? [];
    list.push({ id: r.coach_id, name: pr?.full_name ?? "Coach", isHead: r.is_head });
    rosterByTeam.set(r.team_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teams</h1>
        <p className="text-sm text-muted-foreground">{teams?.length ?? 0} active teams</p>
        {teamsError && (
          <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Could not load teams: {teamsError.message}
          </p>
        )}
      </div>

      {(teams ?? []).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No teams yet</CardTitle>
            <CardDescription>Teams are created by coaches.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(teams ?? []).map((t: {
            id: string; name: string; age_group: string | null; invite_code: string;
            coach_id: string | null;
            team_members: { player_id: string; active: boolean }[];
          }) => {
            // Coach names come from the roster query; before migration 019 that
            // is empty and the card simply shows no coach.
            const roster = rosterByTeam.get(t.id) ?? [];
            const activeCount = (t.team_members ?? []).filter((m) => m.active).length;

            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    {t.age_group && <p className="text-sm text-muted-foreground">{t.age_group}</p>}
                  </div>
                  <Badge variant="brand">{t.age_group ?? "Open"}</Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />
                  <span>{activeCount} player{activeCount !== 1 ? "s" : ""}</span>
                </div>

                {(() => {
                  if (roster.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        No coach yet — share the coach code below.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {roster.length === 1 ? "Coach" : `Coaches (${roster.length})`}
                      </p>
                      <ul className="space-y-0.5">
                        {roster.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium truncate">{c.name}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {c.isHead && <Badge variant="neutral">Head</Badge>}
                              {c.id !== "legacy" && (
                                <RemoveCoachButton teamId={t.id} coachId={c.id} coachName={c.name} />
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                <div className="pt-1 border-t border-border grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Player invite code</p>
                    <p className="font-mono font-bold tracking-widest">{t.invite_code}</p>
                  </div>
                  <CoachCodeBlock teamId={t.id} code={coachCodeById.get(t.id) ?? null} />
                </div>

                <TeamActions teamId={t.id} name={t.name} ageGroup={t.age_group ?? ""} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
