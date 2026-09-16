import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FilmBoard, type FilmTeam } from "@/components/tactics/film-board";
import { getCoachedTeamIds } from "@/lib/coached-teams";

export default async function CoachFilmPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("name");

  const teams: FilmTeam[] = (data ?? []).map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/coach/tactics" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Tactics
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Match Film</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Freeze a frame from a phone clip or a photo and draw over it — like a TV analyst
            breaking down a play. The clip itself never leaves your device; only the frame you
            freeze and your drawings get saved.
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a team yet. Create one in the Squad tab, then come back to
          break down a play with your players.
        </p>
      ) : (
        <FilmBoard teams={teams} />
      )}
    </div>
  );
}
