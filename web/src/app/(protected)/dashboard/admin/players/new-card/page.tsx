import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManualPlayerCardForm, type ManualCardTeam } from "@/components/records/manual-player-card-form";

export default async function NewPlayerCardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

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
        <Link href="/dashboard/admin/players" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create a player card</h1>
          <p className="text-muted-foreground text-sm mt-1">
            For a player already registered and verified with SAFA — enter their details for a
            card in the same format an uploaded registration PDF would produce.
          </p>
        </div>
      </div>

      <ManualPlayerCardForm teams={(teamRows ?? []) as ManualCardTeam[]} />
    </div>
  );
}
