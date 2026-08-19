import { LinkifiedText } from "@/components/linkified-text";
import { redirect } from "next/navigation";
import { Megaphone, PenLine, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { AnnouncementForm } from "./announcement-form";
import { DeleteAnnouncementButton } from "./delete-announcement-button";
import { formatRelativeTime } from "@/lib/utils";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function CoachAnnouncementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <EmptyState
          icon={<Megaphone className="size-8 text-muted-foreground/40" />}
          title="No teams yet"
          description="Create a team first before posting announcements."
        />
      </div>
    );
  }

  const teamIds = allTeams.map((t) => t.id);

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, team_id")
    .in("team_id", teamIds)
    .order("created_at", { ascending: false });

  const announcementIds = (announcements ?? []).map((a) => a.id);
  const { data: readCountsRaw } = announcementIds.length
    ? await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .in("announcement_id", announcementIds)
        .not("read_at", "is", null)
    : { data: [] };

  const readCountMap = new Map<string, number>();
  for (const r of (readCountsRaw ?? []) as { announcement_id: string }[]) {
    readCountMap.set(r.announcement_id, (readCountMap.get(r.announcement_id) ?? 0) + 1);
  }

  const teamMap = new Map(allTeams.map((t) => [t.id, t.name]));
  const multiTeam = allTeams.length > 1;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Announcements</h1>

      {/* ── Compose ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <PenLine className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Post to squad</span>
        </div>
        <div className="p-4">
          <AnnouncementForm teams={allTeams} />
        </div>
      </section>

      {/* ── Feed ───────────────────────────────────────────────── */}
      {(announcements ?? []).length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-8 text-muted-foreground/40" />}
          title="Nothing posted yet"
          description="Use the form above to send your first message."
        />
      ) : (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Posted · {(announcements ?? []).length}
          </p>
          {(announcements ?? []).map((a) => {
            const teamName = teamMap.get(a.team_id);
            const isRecent = Date.now() - new Date(a.created_at).getTime() < 24 * 3_600_000;
            const readCount = readCountMap.get(a.id) ?? 0;
            return (
              <article
                key={a.id}
                className="group flex gap-0 overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="w-1 shrink-0 bg-primary" />
                <div className="flex flex-1 items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold leading-snug">{a.title}</p>
                      {isRecent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      <LinkifiedText text={a.body} />
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {multiTeam && teamName && (
                        <Badge variant="outline" className="text-xs">{teamName}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(a.created_at)}
                      </span>
                      {readCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="size-3" aria-hidden="true" />
                          {readCount} read
                        </span>
                      )}
                    </div>
                  </div>
                  <DeleteAnnouncementButton id={a.id} title={a.title} />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function EmptyState({ icon, title, description }: {
  icon: React.ReactNode; title: string; description: string;
}) {
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
