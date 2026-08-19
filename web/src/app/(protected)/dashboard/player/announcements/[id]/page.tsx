import { LinkifiedText } from "@/components/linkified-text";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

export default async function PlayerAnnouncementDetailPage({
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
    .eq("active", true)
    .single();

  if (!player) notFound();

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("team_id, teams(name)")
    .eq("player_id", player.id)
    .eq("active", true);

  const teamIds = (memberRows ?? []).map((m: { team_id: string }) => m.team_id);

  const { data: announcement } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, team_id")
    .eq("id", id)
    .in("team_id", teamIds)
    .single();

  if (!announcement) notFound();

  // Mark as read on first view — idempotent (does nothing if record already exists)
  await supabase.from("announcement_reads").upsert(
    { user_id: user.id, announcement_id: id, read_at: new Date().toISOString() },
    { onConflict: "user_id,announcement_id", ignoreDuplicates: true }
  );

  const teamMap = new Map(
    (memberRows ?? []).map((m: {
      team_id: string;
      teams: { name: string } | { name: string }[] | null;
    }) => [
      m.team_id,
      Array.isArray(m.teams) ? m.teams[0]?.name : (m.teams as { name: string } | null)?.name,
    ])
  );

  const teamName = teamMap.get(announcement.team_id);

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/dashboard/player/announcements"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to announcements
      </Link>

      <article className="flex gap-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="w-1 shrink-0 bg-primary" />
        <div className="flex-1 px-5 py-5 space-y-3">
          <h1 className="text-xl font-bold leading-snug">{announcement.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {teamName && (
              <Badge variant="outline" className="text-xs">{teamName}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(announcement.created_at)}
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            <LinkifiedText text={announcement.body} />
          </p>
        </div>
      </article>
    </div>
  );
}
