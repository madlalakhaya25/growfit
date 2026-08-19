import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";

const TYPE_STYLES: Record<string, { label: string; chip: string }> = {
  general:    { label: "General",    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  technical:  { label: "Technical",  chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  tactical:   { label: "Tactical",   chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  fitness:    { label: "Fitness",    chip: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  match_prep: { label: "Match Prep", chip: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  recovery:   { label: "Recovery",   chip: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

export default async function CoachTrainingPage({
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
    .select("id, name, age_group")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = allTeams.find((t) => t.id === teamParam) ?? allTeams[0];

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, title, session_date, location, session_type")
    .eq("team_id", team.id)
    .eq("coach_id", user.id)
    .order("session_date", { ascending: false });

  const now = new Date();
  const upcoming = (sessions ?? []).filter((s) => new Date(s.session_date) >= now);
  const past = (sessions ?? []).filter((s) => new Date(s.session_date) < now);

  type Session = NonNullable<typeof sessions>[number];

  function SessionRow({ s }: { s: Session }) {
    const date = new Date(s.session_date);
    const type = TYPE_STYLES[s.session_type] ?? { label: s.session_type, chip: "bg-slate-100 text-slate-700" };
    return (
      <Link
        href={`/dashboard/coach/training/${s.id}`}
        className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{s.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
            {" · "}
            {date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
            {s.location && ` · ${s.location}`}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", type.chip)}>
          {type.label}
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      {allTeams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allTeams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/coach/training?team=${t.id}`}
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Training</h1>
        <Button asChild>
          <Link href={`/dashboard/coach/training/new?team=${team.id}`}>
            <Plus className="size-4" aria-hidden="true" />
            New session
          </Link>
        </Button>
      </div>

      {(sessions ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Dumbbell className="size-10 text-muted-foreground/30" aria-hidden="true" />
          <div>
            <p className="font-medium">No sessions planned</p>
            <p className="text-sm text-muted-foreground mt-0.5">Schedule a training session to get started.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/coach/training/new?team=${team.id}`}>
              <Plus className="size-4" aria-hidden="true" />
              Plan first session
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Upcoming · {upcoming.length}
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {upcoming.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Past · {past.length}
              </h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {past.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
