"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ExtractedPlayer {
  full_name: string;
  date_of_birth: string | null;
  mysafa_number: string | null;
  fifa_number: string | null;
  id_number: string | null;
  /** e.g. "U15 Level 2" as printed — helps pick the right squad. */
  age_group: string | null;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * Read players off a SAFA/LFA registration PDF.
 *
 * Nothing is written to the database here and the file is never stored — it is
 * held in memory, sent for extraction, and discarded. The caller reviews and
 * edits the rows before anything is created, because OCR of a scanned card is
 * not reliable enough to trust blind.
 *
 * POPIA note: this sends children's registration details to the AI provider for
 * processing. That is a deliberate, reviewable step rather than a background job.
 */
export async function extractPlayersFromPdf(
  formData: FormData
): Promise<{ players?: ExtractedPlayer[]; error?: string }> {
  try {
    await requireUser();

    const file = formData.get("file") as File | null;
    if (!file || !file.size) return { error: "Choose a PDF to upload." };
    if (file.size > MAX_PDF_BYTES) return { error: "PDF must be under 10 MB." };
    if (file.type !== "application/pdf") return { error: "Only PDF files are supported." };

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
                "Return for each player:\n" +
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
    });

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

    const players: ExtractedPlayer[] = parsed
      .map((row) => {
        const r = row as Record<string, unknown>;
        const name = clean(r.full_name);
        if (!name) return null;
        const dob = clean(r.date_of_birth);
        return {
          full_name: name,
          // Keep only dates the model returned in the shape we asked for.
          date_of_birth: dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
          mysafa_number: clean(r.mysafa_number),
          fifa_number: clean(r.fifa_number),
          id_number: clean(r.id_number),
          age_group: clean(r.age_group),
        };
      })
      .filter((p): p is ExtractedPlayer => p !== null);

    if (players.length === 0) return { error: "No players were found in that PDF." };
    return { players };
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
 */
export async function createImportedPlayers(input: {
  rows: ImportRow[];
  teamId?: string;
}): Promise<{ created?: number; skipped?: string[]; error?: string }> {
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

  // Existing registration numbers in this academy, to avoid duplicates.
  const { data: existing } = await supabase
    .from("players")
    .select("mysafa_number, id_number, fifa_number")
    .eq("academy_id", profile.academy_id);

  const taken = new Set<string>();
  for (const e of (existing ?? []) as Record<string, string | null>[]) {
    for (const v of [e.mysafa_number, e.id_number, e.fifa_number]) {
      if (v) taken.add(v.replace(/\s/g, "").toUpperCase());
    }
  }

  const skipped: string[] = [];
  const toInsert = rows.filter((r) => {
    const keys = [r.mysafa_number, r.id_number, r.fifa_number]
      .filter(Boolean)
      .map((v) => v!.replace(/\s/g, "").toUpperCase());
    if (keys.some((k) => taken.has(k))) {
      skipped.push(r.full_name);
      return false;
    }
    keys.forEach((k) => taken.add(k));
    return true;
  });

  if (toInsert.length === 0) {
    return { created: 0, skipped };
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

  // Optionally drop them straight into a squad.
  if (input.teamId && inserted && inserted.length > 0) {
    await supabase.from("team_members").insert(
      inserted.map((p: { id: string }) => ({ team_id: input.teamId, player_id: p.id }))
    );
  }

  revalidatePath("/dashboard/admin/players");
  revalidatePath("/dashboard/coach/squad");
  return { created: inserted?.length ?? 0, skipped };
}
