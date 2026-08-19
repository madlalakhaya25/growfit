"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";

const sessionSchema = z.object({
  team_id: z.string().uuid("Invalid team"),
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  session_date: z.string().min(1, "Date is required"),
  location: z.string().max(120).optional(),
  session_type: z.enum(["general", "technical", "tactical", "fitness", "match_prep", "recovery"]),
  notes: z.string().max(1000).optional(),
});

const drillSchema = z.object({
  session_id: z.string().uuid("Invalid session"),
  title: z.string().min(2, "Title must be at least 2 characters").max(120),
  description: z.string().max(500).optional(),
  video_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

async function getCoachTeamIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("teams")
    .select("id")
    .in("id", await getCoachedTeamIds(supabase, userId))
    .eq("active", true);
  return (data ?? []).map((t: { id: string }) => t.id);
}

export async function createTrainingSession(formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = {
    team_id: formData.get("team_id") as string,
    title: formData.get("title") as string,
    session_date: formData.get("session_date") as string,
    location: (formData.get("location") as string) || undefined,
    session_type: formData.get("session_type") as string,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.includes(parsed.data.team_id)) return { error: "Team not found." };

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: parsed.data.team_id,
      coach_id: user.id,
      title: parsed.data.title,
      session_date: parsed.data.session_date,
      location: parsed.data.location ?? null,
      session_type: parsed.data.session_type,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create session." };
  revalidatePath("/dashboard/coach/training", "page");
  redirect(`/dashboard/coach/training/${data.id}`);
}

export async function createTrainingSessionWithDrills(params: {
  team_id: string;
  title: string;
  session_date: string;
  location?: string;
  session_type: string;
  notes?: string;
  drills: { title: string; description?: string; video_url?: string }[];
}): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();

  const parsed = sessionSchema.safeParse({
    team_id: params.team_id,
    title: params.title,
    session_date: params.session_date,
    location: params.location || undefined,
    session_type: params.session_type,
    notes: params.notes || undefined,
  });

  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.includes(parsed.data.team_id)) return { error: "Team not found." };

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: parsed.data.team_id,
      coach_id: user.id,
      title: parsed.data.title,
      session_date: parsed.data.session_date,
      location: parsed.data.location ?? null,
      session_type: parsed.data.session_type,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create session." };

  if (params.drills.length > 0) {
    const drillRows = params.drills.map((d, i) => ({
      session_id: data.id,
      title: d.title,
      description: d.description || null,
      video_url: d.video_url || null,
      sort_order: i,
    }));
    const { error: drillError } = await supabase.from("training_drills").insert(drillRows);
    if (drillError) return { error: drillError.message };
  }

  revalidatePath("/dashboard/coach/training", "page");
  return { id: data.id };
}

export async function deleteTrainingSession(id: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Session not found." };
  revalidatePath("/dashboard/coach/training", "page");
  return { success: true };
}

export async function addDrill(formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = {
    session_id: formData.get("session_id") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    video_url: (formData.get("video_url") as string) || undefined,
  };

  const parsed = drillSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  // Verify coach owns the session
  const { data: session } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", parsed.data.session_id)
    .eq("coach_id", user.id)
    .single();

  if (!session) return { error: "Session not found." };

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("training_drills")
    .select("sort_order")
    .eq("session_id", parsed.data.session_id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("training_drills").insert({
    session_id: parsed.data.session_id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    video_url: parsed.data.video_url || null,
    sort_order: nextOrder,
  });

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/coach/training/${parsed.data.session_id}`, "page");
  return { success: true };
}

export async function deleteDrill(drillId: string, sessionId: string) {
  const { supabase, user } = await requireUser();

  // RLS enforces coach ownership — delete will no-op if not owned
  const { data, error } = await supabase
    .from("training_drills")
    .delete()
    .eq("id", drillId)
    .select("id");

  // Verify session ownership separately to give a meaningful error
  if (!data?.length) {
    const { data: session } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("coach_id", user.id)
      .single();
    if (!session) return { error: "Drill not found or access denied." };
  }

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/coach/training/${sessionId}`, "page");
  return { success: true };
}

export async function setAttendance(sessionId: string, status: "attending" | "unavailable") {
  const { supabase, user } = await requireUser();

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
    .single();

  if (!player) return { error: "Player profile not found." };

  const { error } = await supabase.from("training_attendance").upsert(
    { session_id: sessionId, player_id: player.id, status },
    { onConflict: "session_id,player_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/player/training/${sessionId}`, "page");
  revalidatePath(`/dashboard/coach/training/${sessionId}`, "page");
  return { success: true };
}
