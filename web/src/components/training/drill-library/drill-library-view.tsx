import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { loadLibraryDrills, loadLibraryPlays, loadUpcomingSessions } from "@/lib/drill-library-data";
import { PageHeader } from "@/components/ui/page-header";
import { LibraryBrowser } from "./library-browser";

/**
 * The academy drill library, shared by the coach page (under Training) and
 * the admin page. One list for U11, U13 and U15 so every coach teaches the
 * same method; the drills the director marks "Academy method" come first.
 */
export async function DrillLibraryView() {
  const profile = await getProfile();
  if (!profile) redirect("/auth/login");
  const supabase = await createClient();
  const academyId = profile.academy_id as string | null;

  if (!academyId) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader title="Drill library" />
        <p className="text-sm text-muted-foreground">Join an academy to see its drill library.</p>
      </div>
    );
  }

  const teamIds = await getCoachedTeamIds(supabase, profile.id as string);
  const [{ drills, tagsReady }, plays, sessions] = await Promise.all([
    loadLibraryDrills(supabase, academyId),
    loadLibraryPlays(supabase, academyId),
    loadUpcomingSessions(supabase, teamIds, new Date().toISOString()),
  ]);
  const isAdmin = profile.role === "admin";

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Drill library"
        description="One way of playing, from U11 to U15. Find a drill by age group or theme and add it to your session."
      />
      {!tagsReady && (
        <p role="status" className="rounded-[10px] bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Age groups, themes and the academy method aren&apos;t set up yet. Your drills still work. Ask your admin to run
          database update 065.
        </p>
      )}
      <LibraryBrowser
        drills={drills}
        plays={plays}
        sessions={sessions}
        isAdmin={isAdmin}
        canPlan={!isAdmin || teamIds.length > 0}
        tagsReady={tagsReady}
      />
    </div>
  );
}
