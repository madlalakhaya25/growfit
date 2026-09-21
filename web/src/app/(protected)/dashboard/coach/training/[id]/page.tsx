import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, PlayCircle, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AddDrillForm } from "./add-drill-form";
import { DeleteSessionButton } from "./delete-session-button";
import { DeleteDrillButton } from "./delete-drill-button";
import { AddFromLibrary } from "./add-from-library";
import { MediaUploadForm } from "@/components/media/media-upload-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { TrainingAttendanceForm } from "@/components/attendance/training-attendance-form";
import { SessionGeneratorPanel } from "@/components/ai/session-generator-panel";

const TYPE_STYLES: Record<string, { label: string; chip: string; header: string }> = {
  general:    { label: "General",    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",       header: "bg-slate-500/10" },
  technical:  { label: "Technical",  chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",         header: "bg-blue-500/10" },
  tactical:   { label: "Tactical",   chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", header: "bg-violet-500/10" },
  fitness:    { label: "Fitness",    chip: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", header: "bg-orange-500/10" },
  match_prep: { label: "Match Prep", chip: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",             header: "bg-red-500/10" },
  recovery:   { label: "Recovery",   chip: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",     header: "bg-green-500/10" },
};

export default async function CoachTrainingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id, team_id, title, session_date, location, session_type, notes, teams ( name )")
    .eq("id", id)
    .eq("coach_id", user.id)
    .single();

  if (!session) notFound();

  const [
    { data: drills },
    { data: attendanceRows },
    { data: media },
    { data: squadMembersRaw },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("training_drills")
      .select("id, title, description, video_url, sort_order")
      .eq("session_id", id)
      .order("sort_order"),
    supabase
      .from("training_attendance")
      .select("player_id, status")
      .eq("session_id", id),
    supabase
      .from("media_uploads")
      .select("id, url, media_type, caption, created_at, uploaded_by, media_tags ( player_id, players ( full_name ) )")
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("players ( id, full_name )")
      .eq("team_id", session.team_id)
      .eq("active", true),
    supabase
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .single(),
  ]);

  const libraryDrills = profile?.academy_id
    ? (
        await supabase
          .from("drill_library")
          .select("id, name, description, category, duration_minutes, difficulty, video_url")
          .eq("academy_id", profile.academy_id)
          .order("category")
          .order("name")
      ).data ?? []
    : [];

  type AttendanceRow = { player_id: string; status: string };
  const attending = (attendanceRows ?? []).filter((r: AttendanceRow) => r.status === "attending").length;
  const unavailable = (attendanceRows ?? []).filter((r: AttendanceRow) => r.status === "unavailable").length;

  const date = new Date(session.session_date);
  const teamName = Array.isArray(session.teams)
    ? session.teams[0]?.name
    : (session.teams as { name: string } | null)?.name;

  const typeStyle = TYPE_STYLES[session.session_type] ?? TYPE_STYLES.general;

  // Flatten squad players from nested join
  type SquadMemberRaw = { players: { id: string; full_name: string } | { id: string; full_name: string }[] | null };
  const flattenedSquadPlayers: { id: string; full_name: string }[] = (squadMembersRaw ?? []).flatMap((m: SquadMemberRaw) => {
    if (!m.players) return [];
    return Array.isArray(m.players) ? m.players : [m.players];
  });

  const pendingCount = flattenedSquadPlayers.length - attending - unavailable;
  const allMarked = flattenedSquadPlayers.length > 0 && pendingCount <= 0;

  // Normalize media items: flatten nested media_tags -> tagged_players
  type RawMediaTag = { player_id: string; players: { full_name: string } | { full_name: string }[] | null };
  type RawMediaItem = {
    id: string;
    url: string;
    media_type: string;
    caption: string | null;
    created_at: string;
    uploaded_by: string | null;
    media_tags: RawMediaTag[] | null;
  };
  const normalizedMediaItems = (media ?? []).map((item: RawMediaItem) => ({
    id: item.id,
    url: item.url,
    media_type: item.media_type,
    caption: item.caption,
    created_at: item.created_at,
    uploaded_by: item.uploaded_by,
    tagged_players: (item.media_tags ?? []).flatMap((tag: RawMediaTag) => {
      if (!tag.players) return [];
      return Array.isArray(tag.players) ? tag.players : [tag.players];
    }),
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/coach/training">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Training
        </Link>
      </Button>

      {/* Session header card */}
      <div className={cn("overflow-hidden rounded-xl border border-border", typeStyle.header)}>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", typeStyle.chip)}>
                {typeStyle.label}
              </span>
              <h1 className="text-xl font-bold leading-tight">{session.title}</h1>
            </div>
            <DeleteSessionButton id={id} />
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
            {teamName && (
              <span className="font-medium text-foreground">{teamName}</span>
            )}
          </div>
        </div>

        {session.notes && (
          <div className="border-t border-border/60 bg-background/60 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </div>
        )}

        {(attending > 0 || unavailable > 0 || flattenedSquadPlayers.length > 0) && (
          <div className="border-t border-border/60 bg-background/60 px-5 py-3 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attendance</span>
            {attending > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                {attending} going
              </span>
            )}
            {unavailable > 0 && (
              <span className="flex items-center gap-1 text-destructive font-medium">
                <XCircle className="size-3.5" aria-hidden="true" />
                {unavailable} can&apos;t make it
              </span>
            )}
            {allMarked ? (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                All marked
              </span>
            ) : pendingCount > 0 ? (
              <span className="text-muted-foreground">{pendingCount} pending</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Coach attendance marking */}
      <TrainingAttendanceForm
        sessionId={id}
        players={flattenedSquadPlayers}
        existing={(attendanceRows ?? []) as { player_id: string; status: string }[]}
      />

      {/* Photos & Videos */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Photos &amp; Videos</h2>
          <MediaUploadForm
            teamId={session.team_id}
            sessionId={id}
            academyId={profile?.academy_id ?? ""}
            squadPlayers={flattenedSquadPlayers}
          />
        </div>
        {normalizedMediaItems.length > 0 && (
          <MediaGallery
            items={normalizedMediaItems}
            canDelete
            currentUserId={user?.id}
          />
        )}
        {normalizedMediaItems.length === 0 && (
          <p className="text-sm text-muted-foreground">No media yet — upload training photos or videos.</p>
        )}
      </section>

      {/* Drills */}
      <section className="space-y-4">
        <SessionGeneratorPanel sessionId={id} teamId={session.team_id} />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Drills
            {(drills ?? []).length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {(drills ?? []).length}
              </span>
            )}
          </h2>
        </div>

        {(drills ?? []).length > 0 && (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {(drills ?? []).map((drill, idx) => (
              <div key={drill.id} className="flex items-start gap-3 px-4 py-3.5">
                {/* Step number */}
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
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
                <DeleteDrillButton drillId={drill.id} sessionId={id} />
              </div>
            ))}
          </div>
        )}

        {(drills ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No drills yet — generate with AI above or add manually below.
          </p>
        )}

        <AddFromLibrary sessionId={id} drills={libraryDrills} />
        <AddDrillForm sessionId={id} />
      </section>
    </div>
  );
}
