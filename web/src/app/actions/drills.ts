"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";

const CATEGORIES = ["warm_up", "technical", "tactical", "physical", "small_sided", "cool_down"] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

type DrillCategory = (typeof CATEGORIES)[number];
type DrillDifficulty = (typeof DIFFICULTIES)[number];

export async function saveDrill(data: {
  name: string;
  description?: string;
  category: DrillCategory;
  duration_minutes?: number;
  difficulty?: DrillDifficulty;
  video_url?: string;
}) {
  const { supabase, user } = await requireUser();

  if (!data.name?.trim()) return { error: "Name is required." };
  if (!CATEGORIES.includes(data.category)) return { error: "Invalid category." };
  // `category` was checked at runtime here but `difficulty` never was,
  // despite both being optional user input validated against the same kind
  // of CHECK constraint in the database (migration 012). A caller sending
  // a raw form value cast to `DrillDifficulty` -- exactly what the edit
  // form's <select> does -- bypassed this entirely at compile time and
  // would only be caught by Postgres's own constraint error surfacing
  // as a raw message instead of this action's usual friendly one.
  if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) {
    return { error: "Invalid difficulty." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) return { error: "No academy found." };

  const { error } = await supabase.from("drill_library").insert({
    academy_id: profile.academy_id,
    created_by: user.id,
    name: data.name.trim(),
    description: data.description?.trim() ?? null,
    category: data.category,
    duration_minutes: data.duration_minutes ?? null,
    difficulty: data.difficulty ?? null,
    video_url: data.video_url?.trim() || null,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/coach/training/drills");
  return { success: true };
}

/**
 * Edit a drill in the reusable library.
 *
 * The library supported add and delete only, so correcting a duration or
 * fixing a dead video link meant deleting the drill and retyping it — and
 * any session that had already pulled that drill in kept the old copy,
 * since sessions copy drills rather than referencing them.
 *
 * Scoped to the academy, matching deleteDrill.
 */
export async function updateDrill(
  id: string,
  data: {
    name: string;
    description?: string;
    category: DrillCategory;
    duration_minutes?: number;
    difficulty?: DrillDifficulty;
    video_url?: string;
  }
) {
  const { supabase, user } = await requireUser();

  if (!data.name?.trim()) return { error: "Name is required." };
  if (!CATEGORIES.includes(data.category)) return { error: "Invalid category." };
  if (data.difficulty && !DIFFICULTIES.includes(data.difficulty)) {
    return { error: "Invalid difficulty." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) return { error: "No academy found." };

  const { data: updated, error } = await supabase
    .from("drill_library")
    .update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category,
      duration_minutes: data.duration_minutes ?? null,
      difficulty: data.difficulty ?? null,
      video_url: data.video_url?.trim() || null,
    })
    .eq("id", id)
    .eq("academy_id", profile.academy_id)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!updated?.length) return { error: "Drill not found." };
  revalidatePath("/dashboard/coach/training/drills");
  return { success: true };
}

export async function deleteDrill(id: string) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) return { error: "No academy found." };

  const { error } = await supabase
    .from("drill_library")
    .delete()
    .eq("id", id)
    .eq("academy_id", profile.academy_id);

  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/coach/training/drills");
  return { success: true };
}

export async function addDrillFromLibrary(sessionId: string, drillId: string) {
  const { supabase, user } = await requireUser();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("coach_id", user.id)
    .single();

  if (!session) return { error: "Session not found." };

  const { data: drill } = await supabase
    .from("drill_library")
    .select("name, description, video_url")
    .eq("id", drillId)
    .single();

  if (!drill) return { error: "Drill not found." };

  const { data: existing } = await supabase
    .from("training_drills")
    .select("sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("training_drills").insert({
    session_id: sessionId,
    title: drill.name,
    description: drill.description ?? null,
    video_url: drill.video_url ?? null,
    sort_order: nextOrder,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/coach/training/${sessionId}`);
  return { success: true };
}
