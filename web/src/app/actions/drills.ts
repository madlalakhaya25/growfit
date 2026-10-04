"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { sanitiseDrillDetails } from "@/lib/drill-details";
import { sanitiseLibraryTags, fourCornerLabel, type LibraryTags } from "@/lib/drill-library";

const CATEGORIES = ["warm_up", "technical", "tactical", "physical", "small_sided", "cool_down"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

type DrillCategory = (typeof CATEGORIES)[number];
type DrillDifficulty = (typeof DIFFICULTIES)[number];

/** The academy-library tags (migration 065). All optional; unknown values are dropped. */
export type DrillTagInput = Partial<Record<keyof LibraryTags, unknown>>;

export type DrillInput = {
  name: string;
  description?: string;
  category: DrillCategory;
  duration_minutes?: number;
  difficulty?: DrillDifficulty;
  video_url?: string;
} & DrillTagInput;

const LIBRARY_PATHS = ["/dashboard/coach/training/drills", "/dashboard/admin/drills"];

function revalidateLibrary() {
  for (const p of LIBRARY_PATHS) revalidatePath(p);
}

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];

interface Editor {
  supabase: Client;
  userId: string;
  academyId: string;
  isAdmin: boolean;
  teamIds: string[];
}

/**
 * Who may write to the academy library: an admin of the academy, or a coach
 * of at least one team in it. A coach with no team yet (or a player/parent)
 * gets null and the action returns its own `{ error }`.
 */
async function libraryEditor(): Promise<Editor | null> {
  const { supabase, user, profile } = await requireStaff();
  if (!profile?.academy_id) return null;
  const coached = await getCoachedTeamIds(supabase, user.id);
  let teamIds: string[] = [];
  if (coached.length > 0) {
    const { data } = await supabase.from("teams").select("id").in("id", coached).eq("academy_id", profile.academy_id);
    teamIds = ((data ?? []) as { id: string }[]).map((t) => t.id);
  }
  const isAdmin = profile.role === "admin";
  if (!isAdmin && teamIds.length === 0) return null;
  return { supabase, userId: user.id, academyId: profile.academy_id, isAdmin, teamIds };
}

function validateBase(data: DrillInput): string | null {
  if (!data.name?.trim()) return "Name is required.";
  if (!CATEGORIES.includes(data.category)) return "Invalid category.";
  // A raw <select> value cast to DrillDifficulty bypasses the type system, so
  // check it at runtime like category rather than let Postgres's CHECK answer.
  if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) return "Invalid difficulty.";
  return null;
}

function basePayload(data: DrillInput) {
  return {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    category: data.category,
    duration_minutes: data.duration_minutes ?? null,
    difficulty: data.difficulty ?? null,
    video_url: data.video_url?.trim() || null,
  };
}

/** A linked diagram must be one of this academy's own saved plays. */
async function playBelongsToAcademy(editor: Editor, playId: string | null): Promise<boolean> {
  if (!playId) return true;
  const { data } = await editor.supabase
    .from("tactic_plays")
    .select("id")
    .eq("id", playId)
    .eq("academy_id", editor.academyId)
    .maybeSingle();
  return Boolean(data);
}

/** Is this library drill curated? Treats a missing column (065 not run) as no. */
async function findLibraryDrill(editor: Editor, id: string): Promise<{ curated: boolean } | null> {
  const full = await editor.supabase
    .from("drill_library")
    .select("id, is_academy_method")
    .eq("id", id)
    .eq("academy_id", editor.academyId)
    .maybeSingle();
  if (!full.error) return full.data ? { curated: full.data.is_academy_method === true } : null;
  if (!isMissingAttributeColumn(full.error)) return null;
  const legacy = await editor.supabase
    .from("drill_library")
    .select("id")
    .eq("id", id)
    .eq("academy_id", editor.academyId)
    .maybeSingle();
  return legacy.data ? { curated: false } : null;
}

export async function saveDrill(data: DrillInput) {
  const editor = await libraryEditor();
  if (!editor) return { error: "Only coaches and admins of the academy can add drills." };

  const invalid = validateBase(data);
  if (invalid) return { error: invalid };
  const tags = sanitiseLibraryTags(data);
  if (!(await playBelongsToAcademy(editor, tags.tactic_play_id))) return { error: "That play isn't in your academy." };

  const base = { academy_id: editor.academyId, created_by: editor.userId, ...basePayload(data) };
  let { error } = await editor.supabase.from("drill_library").insert({ ...base, ...tags });
  // Migration 065 not run yet: keep the drill, drop the tags.
  if (isMissingAttributeColumn(error)) ({ error } = await editor.supabase.from("drill_library").insert(base));

  if (error) return { error: friendlyError(error) };
  revalidateLibrary();
  return { success: true };
}

/**
 * Edit a library drill. Sessions copy a drill when they pull it in, so this
 * changes the library entry and future sessions only. An academy method drill
 * is the director's to change.
 */
export async function updateDrill(id: string, data: DrillInput) {
  const editor = await libraryEditor();
  if (!editor) return { error: "Only coaches and admins of the academy can edit drills." };

  const invalid = validateBase(data);
  if (invalid) return { error: invalid };
  const tags = sanitiseLibraryTags(data);
  if (!(await playBelongsToAcademy(editor, tags.tactic_play_id))) return { error: "That play isn't in your academy." };

  const found = await findLibraryDrill(editor, id);
  if (!found) return { error: "Drill not found." };
  if (found.curated && !editor.isAdmin) return { error: "Only an admin can change an academy method drill." };

  const base = basePayload(data);
  const update = (payload: Record<string, unknown>) =>
    editor.supabase.from("drill_library").update(payload).eq("id", id).eq("academy_id", editor.academyId).select("id");
  let { data: updated, error } = await update({ ...base, ...tags });
  if (isMissingAttributeColumn(error)) ({ data: updated, error } = await update(base));

  if (error) return { error: friendlyError(error) };
  if (!updated?.length) return { error: "Drill not found." };
  revalidateLibrary();
  return { success: true };
}

export async function deleteDrill(id: string) {
  const editor = await libraryEditor();
  if (!editor) return { error: "Only coaches and admins of the academy can remove drills." };

  const found = await findLibraryDrill(editor, id);
  if (!found) return { error: "Drill not found." };
  if (found.curated && !editor.isAdmin) return { error: "Only an admin can remove an academy method drill." };

  const { error } = await editor.supabase.from("drill_library").delete().eq("id", id).eq("academy_id", editor.academyId);
  if (error) return { error: friendlyError(error) };
  revalidateLibrary();
  return { success: true };
}

/** Admin only: mark (or unmark) a drill as the academy method. */
export async function setAcademyMethod(id: string, on: boolean) {
  const editor = await libraryEditor();
  if (!editor?.isAdmin) return { error: "Only an admin can choose the academy method." };

  const { data: updated, error } = await editor.supabase
    .from("drill_library")
    .update({ is_academy_method: on === true })
    .eq("id", id)
    .eq("academy_id", editor.academyId)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!updated?.length) return { error: "Drill not found." };
  revalidateLibrary();
  return { success: true };
}

const LIBRARY_DRILL_FULL =
  "name, description, video_url, duration_minutes, coaching_points, equipment, players_needed, four_corner";

/** Session drill details built from a library drill, so the plan keeps its coaching points. */
function detailsFromLibrary(drill: Record<string, unknown>) {
  const setup = [
    drill.players_needed ? `${String(drill.players_needed)} players` : "",
    typeof drill.equipment === "string" ? drill.equipment : "",
  ].filter(Boolean).join(" · ");
  return sanitiseDrillDetails({
    durationMinutes: drill.duration_minutes ?? 0,
    fourCorner: typeof drill.four_corner === "string" ? fourCornerLabel(drill.four_corner) : "",
    setup,
    coachingPoints: drill.coaching_points ?? "",
    instructions: "",
    ltpdFocus: "",
  });
}

/**
 * Copy a library drill into a session plan. The caller must coach the
 * session's team (not merely have created it — a co-coach may plan too), and
 * the drill must be in the caller's academy.
 */
export async function addDrillFromLibrary(sessionId: string, drillId: string) {
  const editor = await libraryEditor();
  if (!editor) return { error: "Session not found." };

  const { data: session } = await editor.supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .in("team_id", editor.teamIds)
    .maybeSingle();
  if (!session) return { error: "Session not found." };

  const pick = (columns: string) =>
    editor.supabase.from("drill_library").select(columns).eq("id", drillId).eq("academy_id", editor.academyId).maybeSingle();
  const first = await pick(LIBRARY_DRILL_FULL);
  let drill = first.data;
  if (isMissingAttributeColumn(first.error)) ({ data: drill } = await pick("name, description, video_url, duration_minutes"));
  if (!drill) return { error: "Drill not found." };
  const d = drill as unknown as Record<string, unknown>;

  const { data: existing } = await editor.supabase
    .from("training_drills")
    .select("sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;

  const row = {
    session_id: sessionId,
    title: String(d.name).slice(0, 120),
    description: typeof d.description === "string" ? d.description.slice(0, 500) : null,
    video_url: (d.video_url as string | null) ?? null,
    sort_order: nextOrder,
  };
  let { error } = await editor.supabase.from("training_drills").insert({ ...row, details: detailsFromLibrary(d) });
  // Migration 052 not run: the session drill still lands, without its plan.
  if (isMissingAttributeColumn(error)) ({ error } = await editor.supabase.from("training_drills").insert(row));

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/training/${sessionId}`);
  return { success: true };
}

/**
 * "Share to library": copy a drill from one of the caller's sessions into the
 * academy library with age groups and themes. Shared once per session drill.
 */
export async function shareSessionDrillToLibrary(sessionDrillId: string, input: DrillTagInput & { category?: string }) {
  const editor = await libraryEditor();
  if (!editor) return { error: "Only coaches of the academy can share drills." };

  const { data: drill } = await editor.supabase
    .from("training_drills")
    .select("id, title, description, video_url, details, training_sessions!inner ( team_id )")
    .eq("id", sessionDrillId)
    .maybeSingle();
  const session = drill?.training_sessions as { team_id: string } | { team_id: string }[] | null | undefined;
  const teamId = Array.isArray(session) ? session[0]?.team_id : session?.team_id;
  if (!drill || !teamId || !editor.teamIds.includes(teamId)) return { error: "Drill not found." };

  const { data: already, error: lookupError } = await editor.supabase
    .from("drill_library")
    .select("id")
    .eq("academy_id", editor.academyId)
    .eq("source_drill_id", sessionDrillId)
    .limit(1);
  if (isMissingAttributeColumn(lookupError)) {
    return { error: "The academy library isn't set up yet. Ask your admin to run migration 065." };
  }
  if (already?.length) return { error: "This drill is already in the library." };

  const details = sanitiseDrillDetails(drill.details);
  const tags = sanitiseLibraryTags({
    ...input,
    coaching_points: input.coaching_points ?? details?.coachingPoints,
    equipment: input.equipment ?? details?.setup,
  });
  const category = CATEGORIES.includes(input.category as DrillCategory) ? (input.category as DrillCategory) : "technical";

  const { error } = await editor.supabase.from("drill_library").insert({
    academy_id: editor.academyId,
    created_by: editor.userId,
    name: String(drill.title),
    description: (drill.description as string | null) ?? null,
    category,
    duration_minutes: details?.durationMinutes || null,
    video_url: (drill.video_url as string | null) ?? null,
    source_drill_id: sessionDrillId,
    ...tags,
  });

  if (error) return { error: friendlyError(error) };
  revalidateLibrary();
  return { success: true };
}
