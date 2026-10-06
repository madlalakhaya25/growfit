import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, PlayCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { cn } from "@/lib/utils";
import { AddDrillForm } from "./add-drill-form";
import { DeleteSessionButton } from "./delete-session-button";
import { EditSessionButton } from "./edit-session-button";
import { DeleteDrillButton } from "./delete-drill-button";
import { AddFromLibrary } from "./add-from-library";
import { MediaUploadForm } from "@/components/media/media-upload-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { TrainingAttendanceForm } from "@/components/attendance/training-attendance-form";
import { formatInTimezone, formatTime } from "@/lib/time";
import { SessionGeneratorPanel } from "@/components/ai/session-generator-panel";
import { recentTurnout } from "@/lib/recent-turnout";
import { SessionRunner } from "@/components/training/session-runner";
import { DrillDetailsView } from "@/components/training/drill-details-view";
import { sanitiseDrillDetails } from "@/lib/drill-details";
import { loadCoachNotes } from "@/lib/coach-notes";
import { CoachNotesBox } from "@/components/development/coach-notes-box";
import { ShareToLibraryButton } from "@/components/training/drill-library/share-to-library-button";
import { ageGroupFromTeam } from "@/lib/drill-library";
import { QueryTabs } from "@/components/ui/query-tabs";
import { pickTab } from "@/lib/tabs";
import { CurriculumPicker } from "@/components/curriculum/curriculum-picker";
import { curriculumAgeGroupFromTeam, groupForAgeGroup } from "@/lib/curriculum";
import { loadCurriculum, loadLinkedItemIds } from "@/lib/curriculum-data";

const TABS = [
  { id: "plan", label: "Plan" },
  { id: "register", label: "Register" },
  { id: "notes", label: "Notes" },
] as const;

// A tab that isn't open loads nothing for its data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NONE = Promise.resolve({ data: [] as any[] });
const NO_PROFILE = Promise.resolve({ data: null as { academy_id: string | null } | null });

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const tab = pickTab(TABS, tabParam);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Scoped to teams the caller coaches, not to who created the session — a
  // co-coach sharing this team can open it too (migration 038; before that,
  // `coach_id = user.id` here 404'd a session's own co-coach out of it).
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id, team_id, title, session_date, location, session_type, notes, teams ( name, age_group )")
    .eq("id", id)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
    .single();

  if (!session) notFound();

  const onPlan = tab === "plan";
  const onRegister = tab === "register";
  const onNotes = tab === "notes";
  const [
    { data: drills },
    { data: attendanceRows },
    { data: rsvpRows },
    { data: media },
    { data: squadMembersRaw },
    { data: profile },
  ] = await Promise.all([
    onPlan
      ? supabase
          .from("training_drills")
          .select("id, title, description, video_url, sort_order, details")
          .eq("session_id", id)
          .order("sort_order")
      : NONE,
    // `marked_by`/`marked_at` let the register say who actually marked it
    // (docs/BACKLOG.md 2.9) — a fact two co-coaches on the same team can
    // otherwise disagree about without either one noticing.
    onRegister
      ? supabase
          .from("training_attendance")
          .select("player_id, status, marked_by, marked_at, profiles ( full_name )")
          .eq("session_id", id)
      : NONE,
    onRegister ? supabase.from("training_rsvps").select("player_id, response").eq("session_id", id) : NONE,
    onNotes
      ? supabase
          .from("media_uploads")
          .select("id, url, media_type, caption, created_at, uploaded_by, media_tags ( player_id, players ( full_name ) )")
          .eq("session_id", id)
          .order("created_at", { ascending: false })
      : NONE,
    onRegister || onNotes
      ? supabase
          .from("team_members")
          .select("players ( id, full_name )")
          .eq("team_id", session.team_id)
          .eq("active", true)
      : NONE,
    onPlan || onNotes
      ? supabase
          .from("profiles")
          .select("academy_id")
          .eq("id", user.id)
          .single()
      : NO_PROFILE,
  ]);

  const libraryDrills = onPlan && profile?.academy_id
    ? (
        await supabase
          .from("drill_library")
          .select("id, name, description, category, duration_minutes, difficulty, video_url")
          .eq("academy_id", profile.academy_id)
          .order("category")
          .order("name")
      ).data ?? []
    : [];

  const date = new Date(session.session_date);
  const teamName = Array.isArray(session.teams)
    ? session.teams[0]?.name
    : (session.teams as { name: string } | null)?.name;

  const typeStyle = TYPE_STYLES[session.session_type] ?? TYPE_STYLES.general;
  const teamAgeGroup = ageGroupFromTeam(
    (Array.isArray(session.teams) ? session.teams[0] : (session.teams as { age_group: string | null } | null))?.age_group
  );

  // Flatten squad players from nested join
  type SquadMemberRaw = { players: { id: string; full_name: string } | { id: string; full_name: string }[] | null };
  const flattenedSquadPlayers: { id: string; full_name: string }[] = (squadMembersRaw ?? []).flatMap((m: SquadMemberRaw) => {
    if (!m.players) return [];
    return Array.isArray(m.players) ? m.players : [m.players];
  });

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

  // Optional "what is this about?" list from the academy's curriculum. Empty
  // (and so hidden) when the academy has written none for this age group, or
  // when migration 068 has not been run.
  const teamRow = Array.isArray(session.teams) ? session.teams[0] : (session.teams as { age_group: string | null } | null);
  const curriculumAge = curriculumAgeGroupFromTeam(teamRow?.age_group);
  const curriculumGroups = onPlan && curriculumAge
    ? groupForAgeGroup((await loadCurriculum(supabase)).items, curriculumAge)
    : [];
  const linkedItemIds = curriculumGroups.some((g) => g.items.length > 0) ? await loadLinkedItemIds(supabase, "session", id) : [];

  const sessionNotes = onNotes ? await loadCoachNotes(supabase, user.id, "session", [id]) : null;

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
            <div className="flex shrink-0 items-center gap-1">
              <EditSessionButton
                sessionId={id}
                session={{
                  title: session.title,
                  session_date: session.session_date,
                  location: session.location,
                  session_type: session.session_type,
                  notes: session.notes,
                }}
              />
              <DeleteSessionButton id={id} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              {formatInTimezone(date, { weekday: "long", day: "numeric", month: "long" })}
              {" · "}
              {formatTime(date)}
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

      </div>

      <QueryTabs tabs={TABS} active={tab} basePath={`/dashboard/coach/training/${id}`} />

      {onPlan && (
        <>
      {/* Pitch-side view: one drill at a time with a stopwatch. */}
      <SessionRunner drills={(drills ?? []).map((d) => ({ id: d.id, title: d.title, description: d.description, details: sanitiseDrillDetails(d.details) }))} />

      <CurriculumPicker linkType="session" linkId={id} groups={curriculumGroups} initialIds={linkedItemIds} />

      {/* Drills */}
      <section className="space-y-4">
        <SessionGeneratorPanel sessionId={id} teamId={session.team_id} suggestedSquadSize={await recentTurnout(supabase, session.team_id)} />

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
            {(drills ?? []).map((drill, idx) => {
              const details = sanitiseDrillDetails(drill.details);
              return (
              <div key={drill.id} className="flex items-start gap-3 px-4 py-3.5">
                {/* Step number */}
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium leading-snug">{drill.title}</p>
                  {details ? (
                    <DrillDetailsView details={details} />
                  ) : (
                    drill.description && <p className="text-sm text-muted-foreground">{drill.description}</p>
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
                <ShareToLibraryButton sessionDrillId={drill.id} drillTitle={drill.title} teamAgeGroup={teamAgeGroup} />
                <DeleteDrillButton drillId={drill.id} sessionId={id} />
              </div>
              );
            })}
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
        </>
      )}

      {onRegister && (
        <>
      {/* Coach attendance marking — its own header already shows the real
          P/A/L/E summary (attended/assessed/pct/unmarked); a duplicate
          "Attendance" bar used to sit here too, but it filtered on
          migration 005's RSVP vocabulary ('attending'/'unavailable'), which
          migration 036 stopped writing entirely — it had shown 0 going, 0
          can't-make-it and every player "pending" regardless of how the
          register below was actually marked, ever since 036 shipped. */}
      <TrainingAttendanceForm
        sessionId={id}
        players={flattenedSquadPlayers}
        // Rows with no marked_by pre-date migration 051 and were written by the
        // player's own RSVP tap, not by a coach: they are not register marks.
        existing={((attendanceRows ?? []) as { player_id: string; status: string; marked_by: string | null }[])
          .filter((r) => r.marked_by !== null)}
        rsvps={Object.fromEntries(((rsvpRows ?? []) as { player_id: string; response: "going" | "cant" }[]).map((r) => [r.player_id, r.response]))}
        lastMarkedBy={(() => {
          type MarkRow = {
            marked_by: string | null; marked_at: string | null;
            profiles: { full_name: string } | { full_name: string }[] | null;
          };
          const rows = (attendanceRows ?? []) as unknown as MarkRow[];
          const latest = rows
            .filter((r) => r.marked_at)
            .sort((a, b) => +new Date(b.marked_at!) - +new Date(a.marked_at!))[0];
          if (!latest) return null;
          const profile = Array.isArray(latest.profiles) ? latest.profiles[0] : latest.profiles;
          return profile?.full_name ? { name: profile.full_name, at: latest.marked_at! } : null;
        })()}
      />

        </>
      )}

      {onNotes && (
        <>
      {/* Debrief: how it went, typed or spoken. Private to this coach and admins. */}
      <CoachNotesBox
        subjectType="session"
        subjectId={id}
        initialNotes={sessionNotes?.bySubject[id] ?? []}
        available={sessionNotes?.available ?? false}
        label="Session debrief"
        placeholder="How did it go? What worked, what to change next time."
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

        </>
      )}
    </div>
  );
}
