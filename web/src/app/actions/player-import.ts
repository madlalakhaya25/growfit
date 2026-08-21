"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL_DOC } from "@/lib/ai-models";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { extractPdfHeadshots, type CardHeadshot } from "@/lib/pdf-headshots";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ExtractedPlayer {
  full_name: string;
  date_of_birth: string | null;
  mysafa_number: string | null;
  fifa_number: string | null;
  id_number: string | null;
  /** e.g. "U15 Level 2" as printed — helps pick the right squad. */
  age_group: string | null;
  /** A headshot read off the card, paired in by best-effort reading order. */
  photoDataUrl: string | null;
  /** Set when a registration number on this card matches a player already in the academy. */
  matchedPlayerId: string | null;
  matchedPlayerName: string | null;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Write one headshot to a player, via the same bucket, path and upsert
 * convention the profile page's own uploader uses — so a later manual change
 * cleanly replaces it rather than leaving an orphaned file behind.
 *
 * Caller is responsible for confirming the player belongs to their academy.
 */
async function uploadPlayerPhoto(supabase: Db, playerId: string, photoDataUrl: string): Promise<boolean> {
  const match = photoDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return false;
  const [, contentType, b64] = match;
  const ext = contentType === "image/png" ? "png" : "jpg";

  const { error: uploadErr } = await supabase.storage
    .from("player-photos")
    .upload(`${playerId}.${ext}`, Buffer.from(b64, "base64"), { upsert: true, contentType });
  if (uploadErr) return false;

  const { data: { publicUrl } } = supabase.storage
    .from("player-photos")
    .getPublicUrl(`${playerId}.${ext}`);

  const { error: updateErr } = await supabase
    .from("players")
    .update({ photo_url: publicUrl })
    .eq("id", playerId);
  return !updateErr;
}

/**
 * Bind each extracted headshot to the player whose card it was printed on,
 * by matching the registration numbers read off that same card — never by
 * position in a list.
 *
 * Position was tried and abandoned: a single card with a missing or
 * unreadable photo shifts every photo after it one player up, silently
 * putting the wrong child's face on a name. Registration numbers (FIFA
 * Connect ID, MySAFA) are unique per player and printed on the card right
 * under the photo, so they identify the owner outright.
 *
 * A match is only accepted when it is unambiguous in both directions — one
 * photo, one player. Anything ambiguous is left for the reviewer instead of
 * being guessed at, and the count of such photos is returned so the caller
 * can say so plainly.
 *
 * Mutates `players` in place; returns the photos left unclaimed, so the
 * reviewer can place them by hand rather than having them silently binned.
 */
function attachHeadshotsByIdentity(players: ExtractedPlayer[], headshots: CardHeadshot[]): string[] {
  if (headshots.length === 0) return [];
  const key = (v: string | null) => (v ? v.replace(/\s/g, "").toUpperCase() : null);
  const claimed = new Set<number>();

  const bind = (identifiers: (string | null)[], player: ExtractedPlayer): boolean => {
    const keys = identifiers.map(key).filter((k): k is string => !!k && k.length >= 3);
    if (keys.length === 0) return false;
    const hits: number[] = [];
    for (const [i, h] of headshots.entries()) {
      if (claimed.has(i)) continue;
      if (keys.some((k) => h.labels.includes(k))) hits.push(i);
    }
    // Ambiguous in either direction is not a match — leave it to the reviewer.
    if (hits.length !== 1) return false;
    claimed.add(hits[0]);
    player.photoDataUrl = headshots[hits[0]].dataUrl;
    return true;
  };

  // Registration numbers first: unique by definition, so these are exact.
  const stillNeedingPhoto = players.filter(
    (p) => !bind([p.fifa_number, p.mysafa_number, p.id_number], p)
  );

  // Then names, for a card whose numbers didn't read cleanly. Only distinctive
  // parts — a short token risks colliding with another player's name.
  for (const p of stillNeedingPhoto) {
    bind(p.full_name.split(/\s+/).filter((w) => w.length >= 4), p);
  }

  return headshots.filter((_, i) => !claimed.has(i)).map((h) => h.dataUrl);
}

/**
 * Read players — and, where present, their headshot — off a SAFA/LFA
 * registration PDF.
 *
 * Nothing is written to the database here and the file is never stored — it is
 * held in memory, sent for extraction, and discarded. The caller reviews and
 * edits every row, including the photo, before anything is created, because
 * neither the text nor the photo pairing is reliable enough to trust blind.
 *
 * POPIA note: this sends children's registration details and photos to the AI
 * provider for text extraction. That is a deliberate, reviewable step rather
 * than a background job.
 */
export async function extractPlayersFromPdf(
  formData: FormData
): Promise<{
  players?: ExtractedPlayer[];
  error?: string;
  photoWarning?: string;
  /** Photos read off the document that no player could be matched to. */
  unassignedPhotos?: string[];
}> {
  try {
    const { supabase, user } = await requireUser();

    const file = formData.get("file") as File | null;
    if (!file || !file.size) return { error: "Choose a PDF to upload." };
    if (file.size > MAX_PDF_BYTES) return { error: "PDF must be under 10 MB." };
    if (file.type !== "application/pdf") return { error: "Only PDF files are supported." };

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .single();
    const existingPlayersPromise = profileRow?.academy_id
      ? supabase
          .from("players")
          .select("id, full_name, mysafa_number, id_number, fifa_number")
          .eq("academy_id", profileRow.academy_id)
          .eq("active", true)
      : Promise.resolve({ data: [] as { id: string; full_name: string; mysafa_number: string | null; id_number: string | null; fifa_number: string | null }[] });

    const [response, headshots, { data: existingPlayers }] = await Promise.all([

      ai.models.generateContent({
        model: AI_MODEL_DOC,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "application/pdf", data: base64 } },
              {
                text:
                  "This is a South African SAFA player registration card sheet. Each page holds " +
                  "several cards laid out in a grid — read each card as a unit and do not mix " +
                  "fields between cards.\n\n" +
                  "On each card:\n" +
                  "- the SURNAME appears first in capitals, with the first name on the line below\n" +
                  "- the date of birth is prefixed 'dob:' and written DD/MM/YYYY\n" +
                  "- there are usually two reference codes: a shorter one of about five " +
                  "characters that begins with 0 (the SAFA/MySAFA number), and a longer one of " +
                  "about seven characters that begins with 1 (the FIFA Connect ID)\n" +
                  "- an age group such as 'U15 Level 2' is shown\n\n" +
                  "Return for each player, IN THE ORDER THE CARDS APPEAR ON THE PAGE (left to right, " +
                  "top to bottom) — this order is used to match each player to their photo, so keep it " +
                  "exact even where a card is hard to read:\n" +
                  "- full_name: first name then surname, normally capitalised (NGIDI / Anelisa " +
                  "becomes 'Anelisa Ngidi')\n" +
                  "- date_of_birth: strictly YYYY-MM-DD, converted from the DD/MM/YYYY on the card\n" +
                  "- mysafa_number: the shorter SAFA code\n" +
                  "- fifa_number: the longer FIFA Connect ID\n" +
                  "- id_number: a 13-digit South African ID number, only if one actually appears\n" +
                  "- age_group: the age group text as printed\n\n" +
                  "Ignore the club name, region, season, gender and card expiry date — they are " +
                  "the same for everyone and are not player fields. Ignore coaches and officials; " +
                  "cards marked 'Player' only. Use null for anything not clearly readable — never " +
                  "guess a number or a date, and never invent a player."
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                full_name: { type: Type.STRING },
                date_of_birth: { type: Type.STRING, nullable: true },
                mysafa_number: { type: Type.STRING, nullable: true },
                fifa_number: { type: Type.STRING, nullable: true },
                id_number: { type: Type.STRING, nullable: true },
                age_group: { type: Type.STRING, nullable: true },
              },
              required: ["full_name"],
            },
          },
        },
      }),
      // Best-effort: never let a headshot extraction problem sink the import.
      extractPdfHeadshots(bytes).catch((): CardHeadshot[] => []),
      existingPlayersPromise,
    ]);

    const raw = (response.text ?? "").trim();
    if (!raw) return { error: "Nothing could be read from that PDF." };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fall back to the first JSON array in the response.
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return { error: "Could not read the document. Try a clearer scan." };
      parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed)) return { error: "Could not read the document." };

    const clean = (v: unknown) => {
      const s = typeof v === "string" ? v.trim() : "";
      return s && s.toLowerCase() !== "null" ? s : null;
    };

    // Same normalisation the create step uses, so "already registered" is
    // decided consistently whether it is caught here (before Create, with a
    // chance to just attach the photo) or as a fallback at Create itself.
    const norm = (v: string | null) => (v ? v.replace(/\s/g, "").toUpperCase() : null);
    const findMatch = (mysafa: string | null, idNumber: string | null, fifa: string | null) => {
      const keys = [norm(mysafa), norm(idNumber), norm(fifa)].filter(Boolean);
      if (keys.length === 0) return null;
      return (existingPlayers ?? []).find((p) =>
        keys.includes(norm(p.mysafa_number)) || keys.includes(norm(p.id_number)) || keys.includes(norm(p.fifa_number))
      ) ?? null;
    };

    const players: ExtractedPlayer[] = parsed
      .map((row): ExtractedPlayer | null => {
        const r = row as Record<string, unknown>;
        const name = clean(r.full_name);
        if (!name) return null;
        const dob = clean(r.date_of_birth);
        const mysafa_number = clean(r.mysafa_number);
        const fifa_number = clean(r.fifa_number);
        const id_number = clean(r.id_number);
        const match = findMatch(mysafa_number, id_number, fifa_number);
        return {
          full_name: name,
          // Keep only dates the model returned in the shape we asked for.
          date_of_birth: dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
          mysafa_number,
          fifa_number,
          id_number,
          age_group: clean(r.age_group),
          photoDataUrl: null, // bound below, by identity rather than position
          matchedPlayerId: match?.id ?? null,
          matchedPlayerName: match?.full_name ?? null,
        };
      })
      .filter((p): p is ExtractedPlayer => p !== null);

    if (players.length === 0) return { error: "No players were found in that PDF." };

    const unassignedPhotos = attachHeadshotsByIdentity(players, headshots);
    const n = unassignedPhotos.length;

    return {
      players,
      unassignedPhotos,
      photoWarning:
        n > 0
          ? `${n} photo${n === 1 ? "" : "s"} on this document couldn't be tied to a specific player — assign ${n === 1 ? "it" : "them"} below, or leave ${n === 1 ? "it" : "them"} out.`
          : undefined,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not process the PDF." };
  }
}

export interface ImportRow extends ExtractedPlayer {
  position: string | null;
}

/**
 * Create the reviewed players. Skips anyone whose registration number already
 * exists in the academy, so re-running an import does not duplicate a squad.
 * Any row carrying a photo (auto-matched or manually attached in the review
 * table) gets it uploaded to the same player-photos bucket and path convention
 * the profile page's own photo uploader uses, so a later manual change from a
 * coach or admin cleanly replaces it rather than leaving an orphaned file.
 */
export async function createImportedPlayers(input: {
  rows: ImportRow[];
  teamId?: string;
}): Promise<{
  created?: number;
  skipped?: string[];
  photosAttached?: number;
  /** Headshots given to already-registered players who had no photo yet. */
  backfilled?: number;
  playerIds?: string[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) return { error: "No academy linked to your account." };
  if (!["admin", "coach"].includes(profile.role)) {
    return { error: "Only a coach or admin can import players." };
  }

  const rows = input.rows.filter((r) => r.full_name.trim().length > 0);
  if (rows.length === 0) return { error: "There are no players to create." };

  // Existing registration numbers in this academy, to avoid duplicates — and
  // who they belong to, so a re-uploaded card can still give its headshot to
  // the player it was printed for.
  const { data: existing } = await supabase
    .from("players")
    .select("id, photo_url, mysafa_number, id_number, fifa_number")
    .eq("academy_id", profile.academy_id);

  const taken = new Set<string>();
  const existingByKey = new Map<string, { id: string; photo_url: string | null }>();
  for (const e of (existing ?? []) as {
    id: string; photo_url: string | null;
    mysafa_number: string | null; id_number: string | null; fifa_number: string | null;
  }[]) {
    for (const v of [e.mysafa_number, e.id_number, e.fifa_number]) {
      if (!v) continue;
      const k = v.replace(/\s/g, "").toUpperCase();
      taken.add(k);
      existingByKey.set(k, { id: e.id, photo_url: e.photo_url });
    }
  }

  const skipped: string[] = [];
  // A card for someone already registered still carries their headshot. If
  // they have no photo yet — created by hand, or imported from a sheet whose
  // photos were missing or unreadable — a later upload should fill that gap
  // rather than discard the photo along with the duplicate row.
  const backfill = new Map<string, string>();
  const toInsert = rows.filter((r) => {
    const keys = [r.mysafa_number, r.id_number, r.fifa_number]
      .filter(Boolean)
      .map((v) => v!.replace(/\s/g, "").toUpperCase());
    if (keys.some((k) => taken.has(k))) {
      skipped.push(r.full_name);
      const owner = keys.map((k) => existingByKey.get(k)).find(Boolean);
      // Only fill an empty photo — never silently replace one already there.
      if (r.photoDataUrl && owner && !owner.photo_url && !backfill.has(owner.id)) {
        backfill.set(owner.id, r.photoDataUrl);
      }
      return false;
    }
    keys.forEach((k) => taken.add(k));
    return true;
  });

  let backfilled = 0;
  if (backfill.size > 0) {
    const results = await Promise.all(
      [...backfill].map(([playerId, dataUrl]) => uploadPlayerPhoto(supabase, playerId, dataUrl))
    );
    backfilled = results.filter(Boolean).length;
  }

  if (toInsert.length === 0) {
    if (backfilled > 0) {
      revalidatePath("/dashboard/admin/players");
      revalidatePath("/dashboard/coach/squad");
    }
    return { created: 0, skipped, backfilled };
  }

  const { data: inserted, error } = await supabase
    .from("players")
    .insert(
      toInsert.map((r) => ({
        academy_id: profile.academy_id,
        full_name: r.full_name.trim(),
        date_of_birth: r.date_of_birth,
        mysafa_number: r.mysafa_number,
        fifa_number: r.fifa_number,
        id_number: r.id_number,
        position: r.position || null,
      }))
    )
    .select("id");

  if (error) return { error: error.message };
  const insertedIds = (inserted ?? []) as { id: string }[];

  // Optionally drop them straight into a squad.
  if (input.teamId && insertedIds.length > 0) {
    await supabase.from("team_members").insert(
      insertedIds.map((p) => ({ team_id: input.teamId, player_id: p.id }))
    );
  }

  // A single insert() call returns rows in the same order they were sent, so
  // toInsert[i] and insertedIds[i] are the same player.
  let photosAttached = 0;
  await Promise.all(
    toInsert.map(async (row, i) => {
      const playerId = insertedIds[i]?.id;
      if (!row.photoDataUrl || !playerId) return;
      if (await uploadPlayerPhoto(supabase, playerId, row.photoDataUrl)) photosAttached++;
    })
  );

  revalidatePath("/dashboard/admin/players");
  revalidatePath("/dashboard/coach/squad");
  return { created: insertedIds.length, skipped, photosAttached, backfilled, playerIds: insertedIds.map((p) => p.id) };
}

/**
 * Attach a headshot to a player who already exists in the academy — used when
 * a re-uploaded registration PDF matches someone already registered. The
 * player is never duplicated; only their photo_url changes, via the same
 * bucket/path/upsert convention the profile page's own uploader uses.
 */
export async function attachHeadshotsToExisting(
  matches: { playerId: string; photoDataUrl: string }[]
): Promise<{ attached?: number; error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id) return { error: "No academy linked to your account." };
  if (!["admin", "coach"].includes(profile.role)) {
    return { error: "Only a coach or admin can attach a player photo." };
  }

  let attached = 0;
  await Promise.all(
    matches.map(async ({ playerId, photoDataUrl }) => {
      // Confirm the player is actually in this academy before writing anything.
      const { data: target } = await supabase
        .from("players")
        .select("id")
        .eq("id", playerId)
        .eq("academy_id", profile.academy_id)
        .single();
      if (!target) return;

      if (await uploadPlayerPhoto(supabase, playerId, photoDataUrl)) attached++;
    })
  );

  revalidatePath("/dashboard/admin/players");
  revalidatePath("/dashboard/coach/squad");
  return { attached };
}
