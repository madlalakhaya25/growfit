import type { SupabaseClient } from "@supabase/supabase-js";

// Not a "use server" file: it exports constants and pure functions as well as
// helpers that take a Supabase client (see lib/ai-artefacts.ts for the split).

export const NOTE_MAX = 2000;
/** A dictated note is a minute or two; this is generous for that, and well under the action body limit. */
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

export type NoteSubject = "player" | "session";
export type NoteSource = "typed" | "voice";

export const isNoteSubject = (v: unknown): v is NoteSubject => v === "player" || v === "session";
export const isNoteSource = (v: unknown): v is NoteSource => v === "typed" || v === "voice";

/** Browsers record webm, mp4 or ogg; anything else is not audio this feature takes. */
export function audioMimeOf(type: string): "audio/webm" | "audio/mp4" | "audio/ogg" | null {
  const base = type.split(";")[0].trim().toLowerCase();
  return base === "audio/webm" || base === "audio/mp4" || base === "audio/ogg" ? base : null;
}

/** One note's text: trimmed, blank lines collapsed, capped. Empty means "nothing to save". */
export function cleanNoteBody(raw: string | null | undefined): string {
  return (raw ?? "")
    .replaceAll("\r\n", "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, NOTE_MAX);
}

export interface CoachNote {
  id: string;
  body: string;
  source: NoteSource;
  createdAt: string;
  mine: boolean;
}

/** `42P01` / `PGRST205`: migration 056 is not applied. */
export function isMissingNotesTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function toNote(r: { id: string; body: string; source: string; created_at: string; author_id: string }, userId: string): CoachNote {
  return {
    id: r.id,
    body: r.body,
    source: isNoteSource(r.source) ? r.source : "typed",
    createdAt: r.created_at,
    mine: r.author_id === userId,
  };
}

type NoteRow = { id: string; body: string; source: string; created_at: string; author_id: string; subject_id: string };

/**
 * The notes this person may see about several subjects at once, newest first
 * within each (30 per subject at most). One query for a whole squad.
 * `available: false` until migration 056.
 */
export async function loadCoachNotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  subjectType: NoteSubject,
  subjectIds: string[]
): Promise<{ available: boolean; bySubject: Record<string, CoachNote[]> }> {
  if (subjectIds.length === 0) return { available: true, bySubject: {} };
  const { data, error } = await supabase
    .from("coach_notes")
    .select("id, body, source, created_at, author_id, subject_id")
    .eq("subject_type", subjectType)
    .in("subject_id", subjectIds)
    .order("created_at", { ascending: false })
    .limit(30 * subjectIds.length);
  if (error) return { available: !isMissingNotesTable(error), bySubject: {} };
  const bySubject: Record<string, CoachNote[]> = {};
  for (const r of (data ?? []) as NoteRow[]) {
    const list = (bySubject[r.subject_id] ??= []);
    if (list.length < 30) list.push(toNote(r, userId));
  }
  return { available: true, bySubject };
}

/**
 * Erase every note about a player. coach_notes.subject_id is polymorphic with
 * no foreign key, so deleting the player does not reach it. A missing table is
 * success: there is nothing to erase and erasure must not wait on a migration.
 */
export async function deleteCoachNotesForPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string
): Promise<{ deleted: boolean }> {
  const { error } = await supabase.from("coach_notes").delete().eq("subject_type", "player").eq("subject_id", playerId);
  if (error) return { deleted: isMissingNotesTable(error) };
  return { deleted: true };
}
