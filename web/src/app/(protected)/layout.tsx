import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { getAcademyFeatures } from "@/lib/features";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  // A player who signed up without a club code is allowed through to the
  // "waiting to be added" state; every other case still needs an academy link.
  if (!profile?.role) redirect("/auth/role");
  if (!profile.academy_id && profile.role !== "player") redirect("/auth/role");

  const supabase = await createClient();
  const features = await getAcademyFeatures(supabase, profile.academy_id);

  // The team switcher (coach only, see dashboard-shell.tsx) needs the list
  // of teams a coach can flip between -- id/name/age_group only, never the
  // roster or fixtures, which the "Ask Growfit" sheet fetches lazily
  // instead so this doesn't run on every page load for every role.
  let teams: { id: string; name: string; age_group: string | null }[] = [];
  if (profile.role === "coach") {
    const { data } = await supabase
      .from("teams")
      .select("id, name, age_group")
      .in("id", await getCoachedTeamIds(supabase, profile.id))
      .eq("active", true)
      .order("name");
    teams = data ?? [];
  }

  return (
    <DashboardShell profile={profile} teams={teams} features={features}>
      {children}
    </DashboardShell>
  );
}
