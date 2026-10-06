"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { cleanLinkRequest, curriculumAgeGroupFromTeam, itemsForTeam } from "@/lib/curriculum";
import { loadCurriculum } from "@/lib/curriculum-data";

/**
 * Say which curriculum items a session or an objective is about, replacing what
 * was there. Staff only; a coach may link only their own teams' work, and only
 * to active items for that team's age group. Optional for coaches, so a missing
 * table is a plain message and never blocks anything else.
 */
export async function setCurriculumLinks(linkType: string, linkId: string, itemIds: string[]) {
  const { supabase, user, profile } = await requireStaff();
  if (!profile) return { error: "Unauthorized" };

  const req = cleanLinkRequest(linkType, linkId, itemIds);
  if (!req) return { error: "Choose up to 20 curriculum items." };

  // The team this work belongs to, read through the user's own session.
  const target = req.linkType === "session"
    ? await supabase.from("training_sessions").select("team_id, teams ( age_group )").eq("id", req.linkId).single()
    : await supabase.from("development_objectives").select("subject_id, teams:subject_id ( age_group )").eq("id", req.linkId).single();
  const row = target.data as { team_id?: string; subject_id?: string; teams?: unknown } | null;
  const teamId = row?.team_id ?? row?.subject_id;
  if (!row || !teamId) return { error: "Not found." };

  if (profile.role !== "admin" && !(await getCoachedTeamIds(supabase, user.id)).includes(teamId)) {
    return { error: "Not found." };
  }

  const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
  const ageGroup = curriculumAgeGroupFromTeam((team as { age_group?: string | null } | null)?.age_group);

  const { available, items } = await loadCurriculum(supabase);
  if (!available) return { error: "Curriculum is not set up yet." };
  const keep = itemsForTeam(items, ageGroup, req.itemIds);

  const { error: clearError } = await supabase
    .from("curriculum_links")
    .delete()
    .eq("link_type", req.linkType)
    .eq("link_id", req.linkId);
  if (clearError) return { error: friendlyError(clearError) };

  if (keep.length > 0) {
    const { error } = await supabase
      .from("curriculum_links")
      .insert(keep.map((item_id) => ({ item_id, link_type: req.linkType, link_id: req.linkId })));
    if (error) return { error: friendlyError(error) };
  }

  revalidatePath("/dashboard/coach/training", "page");
  revalidatePath("/dashboard/admin/academy");
  return { success: true, saved: keep.length };
}
