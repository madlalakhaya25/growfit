"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AI_MODEL_DOC } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { generateWithRetry } from "@/lib/ai-resilient";
import { parseJsonObject } from "@/lib/ai-json";
import {
  cleanPosterRows,
  isRealDate,
  isRealTime,
  kickoffIso,
  matchPosterRows,
  type PosterMatchRow,
} from "@/lib/match-poster";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * Read a match poster (a photo or PDF) into a list of matches.
 *
 * Nothing is written here and the file is never stored: it is sent for reading
 * and discarded. The coach reviews and edits every row before anything is
 * saved, because a poster is a design, not a form, and the model will
 * sometimes misread a name, a date or which side a score belongs to.
 *
 * What goes to the AI provider is the poster the coach chose, nothing else.
 * Posters are public-facing graphics, but a coach could pick any image, so
 * the prompt tells the model to ignore everything that is not a fixture.
 */
export async function readMatchPoster(
  formData: FormData,
): Promise<{ matches?: PosterMatchRow[]; error?: string }> {
  try {
    const { supabase, user } = await requireUser();

    const teamIdField = formData.get("team_id");
    const teamId = typeof teamIdField === "string" ? teamIdField : "";
    const { data: team } = await supabase
      .from("teams")
      .select("id, age_group, academy_id")
      .eq("id", teamId)
      .in("id", await getCoachedTeamIds(supabase, user.id))
      .eq("active", true)
      .single();
    if (!team) return { error: "Team not found." };

    const file = formData.get("file") as File | null;
    if (!file || !file.size) return { error: "Choose a poster to upload." };
    if (file.size > MAX_BYTES) return { error: "The poster must be under 10 MB." };
    if (!ACCEPTED.has(file.type)) return { error: "Use a photo (JPG, PNG, WebP) or a PDF." };

    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const [{ data: academy }, { data: fixtures }] = await Promise.all([
      supabase.from("academies").select("name").eq("id", team.academy_id).single(),
      supabase
        .from("fixtures")
        .select("id, opponent, fixture_date, status")
        .eq("team_id", team.id),
    ]);

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const response = await generateWithRetry(ai, {
      model: AI_MODEL_DOC,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            {
              text:
                "This is a football (soccer) match poster from a South African youth league. " +
                "It lists one or more matches, either upcoming fixtures, finished results, or both.\n\n" +
                "Return every match shown, in the order printed, as an object with:\n" +
                "- home_team: the team printed first or on the left, exactly as printed\n" +
                "- away_team: the team printed second or on the right, exactly as printed\n" +
                "- home_score / away_score: the final score for each side when the poster shows a " +
                "result, as whole numbers; null for a match that has not been played\n" +
                "- date: strictly YYYY-MM-DD. If the poster gives no year, use the year implied by " +
                "the rest of the poster, otherwise the current year\n" +
                "- time: kick-off as 24 hour HH:MM, null if not shown\n" +
                "- venue: the ground or field name, null if not shown\n" +
                "- age_group: the age group printed for that match, such as U11, U13 or U15, null " +
                "if none is printed\n\n" +
                `Today is ${new Date().toISOString().slice(0, 10)}.\n` +
                "Use null for anything not clearly readable. Never guess a score, date or time and " +
                "never invent a match. Do not mix a score from one match into another. Ignore " +
                "sponsors, slogans, logos and decoration. If the image is not a match poster, " +
                "return an empty list.",
            },
          ],
        },
      ],
      config: {
        // Direct-answer extraction: thinking tokens would come out of the output
        // budget and could cut the JSON off mid-list (web/CLAUDE.md).
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  home_team: { type: Type.STRING },
                  away_team: { type: Type.STRING },
                  home_score: { type: Type.INTEGER, nullable: true },
                  away_score: { type: Type.INTEGER, nullable: true },
                  date: { type: Type.STRING, nullable: true },
                  time: { type: Type.STRING, nullable: true },
                  venue: { type: Type.STRING, nullable: true },
                  age_group: { type: Type.STRING, nullable: true },
                },
                required: ["home_team", "away_team"],
              },
            },
          },
          required: ["matches"],
        },
      },
    });

    const parsed = parseJsonObject(response.text ?? "");
    if (!parsed) return { error: "Could not read that poster. Try a clearer photo." };

    const rows = cleanPosterRows(parsed.matches, academy?.name ?? null);
    if (rows.length === 0) return { error: "No matches were found on that poster." };

    return { matches: matchPosterRows(rows, fixtures ?? [], team.age_group ?? null) };
  } catch (err) {
    return { error: aiError(err, "Could not read that poster. Try a clearer photo.") };
  }
}

const applyRowSchema = z.object({
  fixtureId: z.string().uuid().nullable(),
  opponent: z.string().trim().min(2).max(100),
  isHome: z.boolean(),
  date: z.string().refine(isRealDate),
  time: z.string().refine(isRealTime),
  venue: z.string().trim().max(120).nullable(),
  teamScore: z.number().int().min(0).max(30).nullable(),
  opponentScore: z.number().int().min(0).max(30).nullable(),
});

const applySchema = z.object({
  teamId: z.string().uuid(),
  rows: z.array(applyRowSchema).min(1).max(30),
});

export interface PosterOutcome {
  opponent: string;
  /** What happened to this row. */
  status: "created" | "updated" | "skipped";
  /** True when a result was logged as well. */
  resultLogged: boolean;
  note: string | null;
}

type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];
type ApplyRow = z.infer<typeof applyRowSchema>;

/** Create or update the fixture for one reviewed row. Returns its id, or a reason it was left alone. */
async function saveFixture(
  supabase: Db,
  teamId: string,
  row: ApplyRow,
  kickoff: string,
): Promise<{ id: string; status: "created" | "updated" } | { skipped: string }> {
  if (!row.fixtureId) {
    const { data: created, error } = await supabase
      .from("fixtures")
      .insert({
        team_id: teamId,
        opponent: row.opponent,
        venue: row.venue ?? undefined,
        fixture_date: kickoff,
        is_home: row.isHome,
      })
      .select("id")
      .single();
    if (error || !created) return { skipped: friendlyError(error) };
    return { id: created.id as string, status: "created" };
  }

  const { data: existing } = await supabase
    .from("fixtures")
    .select("id, status")
    .eq("id", row.fixtureId)
    .eq("team_id", teamId)
    .single();
  if (!existing) return { skipped: "That fixture wasn't found." };
  if (existing.status === "completed") return { skipped: "This match already has a result, so it was left as it is." };
  if (existing.status === "cancelled") return { skipped: "This match was cancelled, so it was left as it is." };

  const { error } = await supabase
    .from("fixtures")
    .update({
      fixture_date: kickoff,
      is_home: row.isHome,
      ...(row.venue ? { venue: row.venue } : {}),
      // A postponed match with a new date is back on.
      status: "upcoming",
    })
    .eq("id", row.fixtureId)
    .eq("team_id", teamId);
  if (error) return { skipped: friendlyError(error) };
  return { id: row.fixtureId, status: "updated" };
}

/** Log the score for a row's fixture. Returns a note for the coach when it wasn't logged. */
async function saveResult(supabase: Db, fixtureId: string, row: ApplyRow, played: boolean): Promise<string | null> {
  if (!played) return "The score was left out because this match hasn't been played yet.";
  const { data, error } = await supabase.rpc("log_match_result", {
    p_fixture_id: fixtureId,
    p_team_score: row.teamScore,
    p_opponent_score: row.opponentScore,
    p_match_notes: null,
    p_appearances: [],
    p_ratings: [],
  });
  const rpcError = (data as { error?: string } | null)?.error;
  if (!error && !rpcError) return null;
  return `The match is saved, but the result wasn't: ${error ? friendlyError(error) : rpcError}`;
}

async function applyRow(supabase: Db, teamId: string, row: ApplyRow, now: number): Promise<PosterOutcome> {
  const kickoff = kickoffIso(row.date, row.time);
  const saved = await saveFixture(supabase, teamId, row, kickoff);
  if ("skipped" in saved) {
    return { opponent: row.opponent, status: "skipped", resultLogged: false, note: saved.skipped };
  }
  if (row.teamScore === null || row.opponentScore === null) {
    return { opponent: row.opponent, status: saved.status, resultLogged: false, note: null };
  }
  const note = await saveResult(supabase, saved.id, row, new Date(kickoff).getTime() <= now);
  return { opponent: row.opponent, status: saved.status, resultLogged: note === null, note };
}

/**
 * Save the matches a coach has reviewed.
 *
 * Each row either creates a fixture or updates an open one, and, when it
 * carries a score and the match has been played, logs the result through the
 * same `log_match_result` call the result form uses. A fixture that already has
 * a result or was cancelled is never touched: parents were told about those.
 * One row failing does not stop the others, and each gets its own outcome.
 */
export async function applyMatchPoster(
  payload: unknown,
): Promise<{ outcomes?: PosterOutcome[]; error?: string }> {
  const { supabase, user } = await requireUser();

  const parsed = applySchema.safeParse(payload);
  if (!parsed.success) return { error: "Check each match has an opponent, a date and a time." };
  const { teamId, rows } = parsed.data;

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .single();
  if (!team) return { error: "Team not found." };

  // One row at a time, in order: a failure on one must not stop the rest, and
  // the rows are few (a poster, not a bulk import).
  const outcomes: PosterOutcome[] = [];
  const now = Date.now();
  for (const row of rows) {
    outcomes.push(await applyRow(supabase, team.id, row, now));
  }

  revalidatePath("/dashboard/coach/fixtures", "page");
  revalidatePath("/dashboard/parent/fixtures", "page");
  revalidatePath("/dashboard/player/fixtures", "page");
  return { outcomes };
}
