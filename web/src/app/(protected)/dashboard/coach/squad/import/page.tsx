import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayerImportPanel, type ImportTeam } from "@/components/records/player-import-panel";

// Reading a PDF with several cards can take longer than the default limit.
export const maxDuration = 60;

export default async function CoachImportPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  const { data: teamRows } = profile?.academy_id
    ? await supabase
        .from("teams")
        .select("id, name, age_group")
        .eq("academy_id", profile.academy_id)
        .eq("active", true)
        .order("name")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={teamParam ? `/dashboard/coach/squad?team=${teamParam}` : "/dashboard/coach/squad"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import players</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a SAFA registration PDF to create player records in one go, or add
            players by hand. Nothing is created until you have checked the details.
          </p>
        </div>
      </div>

      <PlayerImportPanel
        teams={(teamRows ?? []) as ImportTeam[]}
        defaultTeamId={teamParam ?? (teamRows ?? [])[0]?.id ?? ""}
      />
    </div>
  );
}
