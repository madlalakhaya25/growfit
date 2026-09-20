import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentHub } from "@/components/records/document-hub";
import { PlayerIdentityForm } from "@/components/records/player-identity-form";

/**
 * Registration numbers and season documents, split out of the passport page.
 * These are paperwork rather than football, and keeping them here stops the
 * dashboard becoming one endless scroll on a phone.
 */
export default async function PlayerRecordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id, mysafa_number, id_number")
    .eq("profile_id", user.id)
    .single();

  if (!player) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Records</h1>
        <p className="text-sm text-muted-foreground">
          Your profile isn&apos;t linked yet. Once your coach adds you, your records
          appear here.
        </p>
      </div>
    );
  }

  const currentSeason = new Date().getFullYear().toString();

  const { data: myDocuments } = await supabase
    .from("player_documents")
    .select("document_type, status, signer_name, signed_at, uploaded_at, upload_url")
    .eq("player_id", player.id)
    .eq("season", currentSeason);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/player" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to my passport
        </Link>
        <div>
          <h1 className="text-2xl font-bold">My Records</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your registration numbers and the documents for the {currentSeason} season.
          </p>
        </div>
      </div>

      <section id="registration" className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">My Registration Numbers</h2>
          <p className="text-sm text-muted-foreground">
            Keep these up to date so your parent can link their account to your profile.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <PlayerIdentityForm
            playerId={player.id}
            initial={{ mysafa_number: player.mysafa_number, id_number: player.id_number }}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Documents &amp; Contracts</h2>
          <p className="text-sm text-muted-foreground">
            {currentSeason} season — your parent or guardian signs these on your behalf.
          </p>
        </div>
        <DocumentHub playerId={player.id} season={currentSeason} documents={myDocuments ?? []} readOnly />
      </section>
    </div>
  );
}
