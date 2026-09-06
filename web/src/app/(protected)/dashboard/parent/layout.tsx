import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementNotifier } from "@/components/announcement-notifier";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (profile?.role !== "parent") redirect("/dashboard");

  let teamIds: string[] = [];

  if (profile) {
    const supabase = await createClient();
    const { data: links } = await supabase
      .from("parent_player_links")
      .select("players ( id )")
      .eq("parent_id", profile.id);

    type LinkedPlayer = { id: string };
    const playerIds = (links ?? []).flatMap((l: { players: LinkedPlayer | LinkedPlayer[] | null }) =>
      l.players ? (Array.isArray(l.players) ? l.players : [l.players]) : []
    ).map((p) => p.id);

    if (playerIds.length) {
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id")
        .in("player_id", playerIds)
        .eq("active", true);
      teamIds = [...new Set((members ?? []).map((m: { team_id: string }) => m.team_id))];
    }
  }

  return (
    <>
      <AnnouncementNotifier teamIds={teamIds} />
      {children}
    </>
  );
}
