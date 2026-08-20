import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { generatePlayerCardPdf } from "@/lib/player-card-pdf";

/** Downloadable registration card PDF for one player. Admin only, matching the manual-card creation tool. */
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
  if (!profile || profile.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

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

  let photo: { bytes: Uint8Array; kind: "jpg" | "png" } | null = null;
  if (player.photo_url) {
    try {
      const res = await fetch(player.photo_url);
      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        const bytes = new Uint8Array(await res.arrayBuffer());
        photo = { bytes, kind: contentType.includes("png") ? "png" : "jpg" };
      }
    } catch {
      // No photo yet, or the fetch failed — the card renders an initials
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
