import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, Download, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerPassportCard } from "@/components/player/player-passport-card";
import { PlayerPhotoUpload } from "@/components/player-photo-upload";
import { PlayerAvailabilityControl } from "@/components/records/player-availability-control";
import { POSITIONS, FEET } from "@/lib/types";
import { calculateAge } from "@/lib/player";
import { formatDayMonthYear } from "@/lib/time";
import { ExtendedInfoForm } from "@/components/records/extended-info-form";
import { MedicalForm } from "@/components/records/medical-form";
import { DocumentHub } from "@/components/records/document-hub";
import { DeletePlayerSection } from "@/components/records/delete-player-section";
import { AttributeSummary } from "@/components/player/attribute-summary";
import {
  ALL_ATTR_SELECT,
  averageAttributeRows,
  calculateOverall,
  type AttrKey,
} from "@/lib/attributes";
import { matchRatingAverage } from "@/lib/player";
import { signPlayerPhotoUrl } from "@/lib/player-photo";

export default async function AdminPlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id) redirect("/auth/role");

  const currentSeason = new Date().getFullYear().toString();

  const { data: player } = await supabase
    .from("players")
    .select(`
      id, full_name, position, secondary_pos, preferred_foot, date_of_birth, photo_url, share_token, academy_id,
      school, home_address, id_number, mysafa_number,
      availability_status, availability_note,
      player_attributes ( ${ALL_ATTR_SELECT} ),
      player_ratings (
        id, rating, note, created_at,
        fixtures ( opponent, fixture_date )
      )
    `)
    .eq("id", id)
    .eq("academy_id", profile.academy_id)
    .single();

  if (!player) notFound();

  const photoUrl = await signPlayerPhotoUrl(supabase, player.photo_url);

  const [{ data: medical }, { data: docs }] = await Promise.all([
    supabase.from("player_medical").select("*").eq("player_id", id).maybeSingle(),
    supabase.from("player_documents").select("document_type, status, signer_name, signed_at, uploaded_at, upload_url").eq("player_id", id).eq("season", currentSeason),
  ]);

  type Rating = { id: string; rating: number; note: string | null; created_at: string; fixtures: { opponent: string; fixture_date: string } | { opponent: string; fixture_date: string }[] | null };
  const ratings: Rating[] = player.player_ratings ?? [];
  const matchAvg = matchRatingAverage(ratings.map((r) => r.rating));

  // This page showed the raw match-rating average as "Overall" and never
  // looked at attributes at all, so an admin saw a different number from the
  // coach, the parent and the public passport for the same player.
  const attrs = averageAttributeRows(
    player.player_attributes as Partial<Record<AttrKey, number | null>>[] | null
  );
  const avg = calculateOverall(attrs, player.position) ?? matchAvg;

  const posLabel = POSITIONS.find((p) => p.value === player.position)?.label ?? "—";
  const footLabel = FEET.find((f) => f.value === player.preferred_foot)?.label;
  const age = calculateAge(player.date_of_birth);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/admin/players">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Players
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <PlayerPassportCard
          photoUrl={photoUrl}
          fullName={player.full_name}
          overall={avg}
          posLabel={posLabel}
          badges={
            <>
              <Badge variant="brand">{posLabel}</Badge>
              {age && <Badge variant="neutral">Age {age}</Badge>}
              {footLabel && <Badge variant="neutral">{footLabel} foot</Badge>}
              {player.availability_status === "injured" && <Badge variant="danger">Injured</Badge>}
              {player.availability_status === "unavailable" && <Badge variant="warning">Unavailable</Badge>}
            </>
          }
        >
          <PlayerAvailabilityControl
            playerId={player.id}
            initialStatus={player.availability_status ?? "available"}
            initialNote={player.availability_note ?? null}
          />
          <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Ratings</p>
              <p className="font-semibold">{ratings.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Public passport link</p>
              <p className="font-mono font-semibold text-xs tracking-wide">{player.share_token}</p>
            </div>
          </div>
          <div className="pt-2 flex flex-wrap gap-2">
            <PlayerPhotoUpload playerId={player.id} />
            <Button asChild variant="outline" size="sm">
              <a href={`/api/players/${player.id}/card`}>
                <Download className="size-3.5" aria-hidden="true" />
                Download card
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/print/term-report/${player.id}`} target="_blank" rel="noopener noreferrer">
                <FileText className="size-3.5" aria-hidden="true" />
                Term report
              </a>
            </Button>
          </div>
        </PlayerPassportCard>

        {/* Attributes card */}
        {attrs && (
          <Card>
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent>
              <AttributeSummary attrs={attrs} position={player.position} className="space-y-3" />
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Rating history</h2>
          {ratings.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No ratings yet</CardTitle>
                <CardDescription>Ratings appear after coaches log match results.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {[...ratings]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((r) => {
                  const fixture = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
                  return (
                    <div key={r.id} className="flex items-start gap-4 px-4 py-3">
                      <div className="flex shrink-0 gap-0.5 pt-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={`size-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} aria-hidden="true" />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        {fixture && <p className="font-medium text-sm">vs {fixture.opponent}</p>}
                        {r.note && <p className="text-sm text-muted-foreground mt-0.5">&ldquo;{r.note}&rdquo;</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDayMonthYear(r.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-bold">Player Records</h2>

        {/* Extended info */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="font-semibold">Registration Details</p>
          <ExtendedInfoForm playerId={id} initial={{ school: player.school, home_address: player.home_address, id_number: player.id_number, mysafa_number: player.mysafa_number }} />
        </div>

        {/* Medical */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Medical &amp; Emergency</p>
            {medical?.needs_renewal && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">Renewal needed</span>
            )}
          </div>
          <MedicalForm playerId={id} initial={medical as Record<string, unknown> | null} />
        </div>

        {/* Documents */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="font-semibold">Documents &amp; Contracts · {currentSeason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Signed by the player&apos;s parent or guardian. Read-only view.</p>
          </div>
          <DocumentHub playerId={id} season={currentSeason} documents={docs ?? []} readOnly />
        </div>

        <DeletePlayerSection playerId={player.id} playerName={player.full_name} />
      </section>
    </div>
  );
}
