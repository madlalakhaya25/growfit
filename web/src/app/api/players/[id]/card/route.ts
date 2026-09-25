import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { generatePlayerCardPdf } from "@/lib/player-card-pdf";
import { extractPlayerPhotoPath } from "@/lib/player-photo";

/**
 * Downloadable registration card PDF for one player.
 *
 * Was admin-only, which meant the person the card is actually about could not
 * get it. Now also reachable by the player themselves and by an adult already
 * linked to them — both of whom can see everything on the card anyway.
 *
 * Note `web/src/proxy.ts` exempts all of /api from the auth guard, so this
 * handler is the only thing standing between an anonymous request and a
 * child's card. Every check below is load-bearing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return new NextResponse("Forbidden", { status: 403 });

  // RLS already scopes each of these reads to what the caller may see, so a
  // hit here is proof of entitlement rather than a second guess at it.
  let entitled = profile.role === "admin" || profile.role === "coach";

  if (!entitled) {
    const [{ data: ownRecord }, { data: link }] = await Promise.all([
      supabase.from("players").select("id").eq("id", id).eq("profile_id", user.id).maybeSingle(),
      supabase
        .from("parent_player_links")
        .select("player_id")
        .eq("player_id", id)
        .eq("parent_id", user.id)
        .maybeSingle(),
    ]);
    entitled = Boolean(ownRecord) || Boolean(link);
  }

  if (!entitled) return new NextResponse("Forbidden", { status: 403 });

  const { data: player } = await supabase
    .from("players")
    .select("full_name, date_of_birth, mysafa_number, fifa_number, photo_url, share_token, academy_id, academies ( name, location )")
    .eq("id", id)
    .eq("academy_id", profile.academy_id)
    .single();
  if (!player) return new NextResponse("Player not found", { status: 404 });

  const academy = Array.isArray(player.academies) ? player.academies[0] : player.academies;

  const { data: membership } = await supabase
    .from("team_members")
    .select("teams ( age_group )")
    .eq("player_id", id)
    .limit(1)
    .maybeSingle();
  const membershipTeam = membership?.teams
    ? (Array.isArray(membership.teams) ? membership.teams[0] : membership.teams)
    : null;

  // player-photos is a private bucket (migration 043) -- the caller's own
  // entitlement check above already proves they're allowed to see this
  // photo, so download it with their own session rather than fetching the
  // old public URL, which 404s now.
  let photo: { bytes: Uint8Array; kind: "jpg" | "png" } | null = null;
  const photoPath = extractPlayerPhotoPath(player.photo_url);
  if (photoPath) {
    try {
      const { data: blob, error } = await supabase.storage.from("player-photos").download(photoPath);
      if (!error && blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        photo = { bytes, kind: blob.type.includes("png") ? "png" : "jpg" };
      }
    } catch {
      // No photo yet, or the download failed — the card renders an initials
      // placeholder instead. Never block the download over a missing image.
    }
  }

  const logoPng = await readFile(path.join(process.cwd(), "public", "growfit.png"));
  const passportUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://growfitfa.com"}/passport/${player.share_token}`;

  const pdfBytes = await generatePlayerCardPdf(
    {
      fullName: player.full_name,
      dateOfBirth: player.date_of_birth,
      ageGroup: membershipTeam?.age_group ?? null,
      mysafaNumber: player.mysafa_number,
      fifaNumber: player.fifa_number,
      academyName: academy?.name ?? "Growfit FA",
      academyLocation: academy?.location ?? null,
      passportUrl,
      season: new Date().getFullYear().toString(),
    },
    { logoPng: new Uint8Array(logoPng), photo }
  );

  const filename = `${player.full_name.replace(/\s+/g, "-").toLowerCase()}-card.pdf`;
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
