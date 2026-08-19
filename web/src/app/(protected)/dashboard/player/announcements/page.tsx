import { LinkifiedText } from "@/components/linkified-text";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { DismissAnnouncementButton } from "@/components/dismiss-announcement-button";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default async function PlayerAnnouncementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
    .single();

  if (!player) {
    return (
      <PageShell>
        <EmptyState
          icon={<Megaphone className="size-8 text-muted-foreground/40" />}
          title="No player profile"
          description="Ask your coach to add you to the squad."
        />
      </PageShell>
    );
  }

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("team_id, teams(name)")
    .eq("player_id", player.id)
    .eq("active", true);

  const teamIds = (memberRows ?? []).map((m: { team_id: string }) => m.team_id);

  if (!teamIds.length) {
    return (
      <PageShell>
        <EmptyState
          icon={<Megaphone className="size-8 text-muted-foreground/40" />}
          title="Not in a team yet"
          description="Ask your coach for the team invite code."
        />
      </PageShell>
    );
  }

  const teamMap = new Map(
    (memberRows ?? []).map((m: {
      team_id: string;
      teams: { name: string } | { name: string }[] | null;
    }) => [
      m.team_id,
      Array.isArray(m.teams) ? m.teams[0]?.name : (m.teams as { name: string } | null)?.name,
    ])
  );

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, team_id, announcement_reads(read_at, dismissed_at)")
    .in("team_id", teamIds)
    .order("created_at", { ascending: false });

  type ReadRecord = { read_at: string | null; dismissed_at: string | null };

  const allAnnouncements = announcements ?? [];
  const multiTeam = teamIds.length > 1;

  return (
    <PageShell count={allAnnouncements.filter((a) => {
      const reads = a.announcement_reads as ReadRecord[] | null;
      return !reads?.[0]?.read_at;
    }).length}>
      {allAnnouncements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-8 text-muted-foreground/40" />}
          title="Nothing yet"
          description="Your coach's announcements will appear here."
        />
      ) : (
        <div className="space-y-2">
          {allAnnouncements.map((a) => {
            const reads = a.announcement_reads as ReadRecord[] | null;
            const readRecord = reads?.[0] ?? null;
            const isUnread = !readRecord?.read_at;
            const isAcknowledged = !!readRecord?.dismissed_at;
            const isRecent = Date.now() - new Date(a.created_at).getTime() < 24 * 3_600_000;
            const teamName = teamMap.get(a.team_id);
            return (
              <article
                key={a.id}
                className={cn(
                  "group flex gap-0 overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40 transition-colors",
                  isAcknowledged && "opacity-75"
                )}
              >
                <div className={cn("w-1 shrink-0", isUnread ? "bg-primary" : "bg-border")} />
                <Link
                  href={`/dashboard/player/announcements/${a.id}`}
                  className="flex-1 px-4 py-3.5 space-y-1.5 min-w-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {isUnread && (
                      <span className="size-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
                    )}
                    <p className={cn("font-semibold leading-snug", isUnread ? "text-foreground" : "text-foreground/80")}>
                      {a.title}
                    </p>
                    {isRecent && !isAcknowledged && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    <LinkifiedText text={a.body} />
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {multiTeam && teamName && (
                      <Badge variant="outline" className="text-xs">{teamName}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(a.created_at)}
                    </span>
                  </div>
                </Link>
                <div className="flex items-start pt-3 pr-3">
                  <DismissAnnouncementButton id={a.id} acknowledged={isAcknowledged} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Announcements</h1>
        {count != null && count > 0 && (
          <span className="text-sm text-muted-foreground">{count} messages</span>
        )}
      </div>
      {children}
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
