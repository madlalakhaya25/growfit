import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatTime, formatWeekdayDayMonth } from "@/lib/time";

const TYPE_STYLES: Record<string, { label: string; chip: string }> = {
  general:    { label: "General",    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  technical:  { label: "Technical",  chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  tactical:   { label: "Tactical",   chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  fitness:    { label: "Fitness",    chip: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  match_prep: { label: "Match Prep", chip: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  recovery:   { label: "Recovery",   chip: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

export default async function PlayerTrainingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!player) {
    return (
      <EmptyShell title="My Training">
        <EmptyState
          icon={<Dumbbell className="size-8 text-muted-foreground/40" />}
          title="No player profile"
          description="Ask your coach to add you to the squad."
        />
      </EmptyShell>
    );
  }

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("team_id, teams ( name )")
    .eq("player_id", player.id)
    .eq("active", true);

  const teamIds = (memberRows ?? []).map((m: { team_id: string }) => m.team_id);
  const teamMap = new Map(
    (memberRows ?? []).map((m: { team_id: string; teams: { name: string } | { name: string }[] | null }) => [
      m.team_id,
      Array.isArray(m.teams) ? m.teams[0] : m.teams,
    ])
  );

  if (!teamIds.length) {
    return (
      <EmptyShell title="My Training">
        <EmptyState
          icon={<Dumbbell className="size-8 text-muted-foreground/40" />}
          title="Not in a team yet"
          description="Ask your coach to add you to a squad."
        />
      </EmptyShell>
    );
  }

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, team_id, title, session_date, location, session_type")
    .in("team_id", teamIds)
    .order("session_date", { ascending: false });

  const now = new Date();
  const allSessions = sessions ?? [];
  const upcoming = allSessions.filter((s) => new Date(s.session_date) >= now);
  const past = allSessions.filter((s) => new Date(s.session_date) < now);

  type Session = (typeof allSessions)[number];

  function SessionRow({ s }: { s: Session }) {
    const date = new Date(s.session_date);
    const type = TYPE_STYLES[s.session_type] ?? { label: s.session_type, chip: "bg-slate-100 text-slate-700" };
    const teamInfo = teamMap.get(s.team_id) as { name: string } | null | undefined;

    return (
      <Link
        href={`/dashboard/player/training/${s.id}`}
        className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{s.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatWeekdayDayMonth(date)}
            {" · "}
            {formatTime(date)}
            {s.location && ` · ${s.location}`}
          </p>
          {teamIds.length > 1 && teamInfo && (
            <span className="text-xs text-muted-foreground">{teamInfo.name}</span>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", type.chip)}>
          {type.label}
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Training</h1>

      {allSessions.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-muted-foreground/40" />}
          title="No sessions yet"
          description="Your upcoming training sessions will appear here once your coach schedules them."
        />
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
              <div className="divide-y divide-border rounded-xl border border-border opacity-70">
                {past.map((s) => <SessionRow key={s.id} s={s} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      {icon}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
