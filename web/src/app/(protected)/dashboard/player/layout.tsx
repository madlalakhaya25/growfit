import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FixtureNotifier } from "@/components/fixture-notifier";
import { AnnouncementNotifier } from "@/components/announcement-notifier";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (profile?.role !== "player") redirect("/dashboard");

  let teamIds: string[] = [];

  if (profile) {
    const supabase = await createClient();
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .single();

    if (player) {
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("player_id", player.id)
        .eq("active", true);
      teamIds = (members ?? []).map((m: { team_id: string }) => m.team_id);
    }
  }

  return (
    <>
      <FixtureNotifier teamIds={teamIds} />
      <AnnouncementNotifier teamIds={teamIds} />
      {children}
    </>
  );
}
