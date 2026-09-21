import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AttendanceButton } from "@/components/attendance-button";

const TYPE_STYLES: Record<string, { label: string; chip: string; header: string }> = {
  general:    { label: "General",    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",       header: "bg-slate-500/10" },
  technical:  { label: "Technical",  chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",         header: "bg-blue-500/10" },
  tactical:   { label: "Tactical",   chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", header: "bg-violet-500/10" },
  fitness:    { label: "Fitness",    chip: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", header: "bg-orange-500/10" },
  match_prep: { label: "Match Prep", chip: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",             header: "bg-red-500/10" },
  recovery:   { label: "Recovery",   chip: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",     header: "bg-green-500/10" },
};

export default async function PlayerTrainingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!player) redirect("/dashboard/player/training");

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id, team_id, title, session_date, location, session_type, notes, teams ( name )")
    .eq("id", id)
    .single();

  if (!session) notFound();

  const { data: drills } = await supabase
    .from("training_drills")
    .select("id, title, description, video_url, sort_order")
    .eq("session_id", id)
    .order("sort_order");

  const { data: attendance } = await supabase
    .from("training_attendance")
    .select("status")
    .eq("session_id", id)
    .eq("player_id", player.id)
    .maybeSingle();

  const date = new Date(session.session_date);
  const teamName = Array.isArray(session.teams)
    ? session.teams[0]?.name
    : (session.teams as { name: string } | null)?.name;

  const typeStyle = TYPE_STYLES[session.session_type] ?? TYPE_STYLES.general;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/player/training" className="text-sm text-muted-foreground hover:text-foreground">
        ← Training
      </Link>

      {/* Session header */}
      <div className={cn("overflow-hidden rounded-xl border border-border", typeStyle.header)}>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1">
            <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", typeStyle.chip)}>
              {typeStyle.label}
            </span>
            <h1 className="text-xl font-bold leading-tight">{session.title}</h1>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              {date.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
              {" · "}
              {date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {session.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {session.location}
              </span>
            )}
            {teamName && <span className="font-medium text-foreground">{teamName}</span>}
          </div>
        </div>

        {session.notes && (
          <div className="border-t border-border/60 bg-background/60 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}
      </div>

      {/* Attendance */}
      <div className="rounded-xl border border-border bg-card px-4 py-3.5">
        <p className="text-sm font-medium mb-3">Are you attending?</p>
        <AttendanceButton
          sessionId={id}
          // The column holds the shared P/A/L/E vocabulary (migration 036);
          // setAttendance() writes 'present'/'excused' for this RSVP, so
          // translate back rather than comparing against values it can
          // never actually contain. A coach-marked 'late'/'absent' (set
          // after the session, not by this button) shows as neither button
          // active — this control is asking about the player's own RSVP,
          // not overriding the coach's final register.
          current={
            attendance?.status === "present" ? "attending" :
            attendance?.status === "excused" ? "unavailable" :
            null
          }
        />
      </div>

      {/* Drills */}
      {(drills ?? []).length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Drills
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {(drills ?? []).length}
            </span>
          </h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {(drills ?? []).map((drill, idx) => (
              <div key={drill.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium leading-snug">{drill.title}</p>
                  {drill.description && (
                    <p className="text-sm text-muted-foreground">{drill.description}</p>
                  )}
                  {drill.video_url && (
                    <a
                      href={drill.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                    >
                      <PlayCircle className="size-3.5" aria-hidden="true" />
                      Watch video
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No drills planned for this session yet.</p>
      )}
    </div>
  );
}
