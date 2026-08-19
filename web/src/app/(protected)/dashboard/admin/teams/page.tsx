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

  const { data: teams } = await supabase
    .from("teams")
    .select(`
      id, name, age_group, invite_code, coach_code, active, created_at,
      profiles ( full_name ),
      team_coaches ( coach_id, is_head, profiles ( full_name ) ),
      team_members ( player_id, active )
    `)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teams</h1>
        <p className="text-sm text-muted-foreground">{teams?.length ?? 0} active teams</p>
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
            id: string; name: string; age_group: string | null; invite_code: string; coach_code: string | null;
            team_coaches?: { coach_id: string; is_head: boolean; profiles: { full_name: string } | { full_name: string }[] | null }[];
            profiles: { full_name: string } | { full_name: string }[] | null;
            team_members: { player_id: string; active: boolean }[];
          }) => {
            const coach = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
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
                  const roster = (t.team_coaches ?? []).map((tc) => {
                    const pr = Array.isArray(tc.profiles) ? tc.profiles[0] : tc.profiles;
                    return { id: tc.coach_id, name: pr?.full_name ?? "Coach", isHead: tc.is_head };
                  });
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
                              <RemoveCoachButton teamId={t.id} coachId={c.id} coachName={c.name} />
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
                  <CoachCodeBlock teamId={t.id} code={t.coach_code} />
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
