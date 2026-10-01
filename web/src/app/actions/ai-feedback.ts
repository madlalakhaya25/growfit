"use server";

import { requireStaff } from "@/lib/auth";
import { coachesPlayer } from "@/lib/coached-teams";
import { reportError } from "@/lib/report-error";

/**
 * 👍 / 👎 on a stored AI output (player insights, academy health, ...).
 *
 * RLS on ai_artefacts is academy-wide for staff, so the per-subject boundary is
 * enforced here, the same way as everywhere an AI action touches a player: a
 * coach may rate an output about a player only if they coach that player.
 * (Development plans have their own action, which also checks the plan kind.)
 */
export async function setAiArtefactFeedback(
  artefactId: string,
  feedback: "helpful" | "not_helpful" | null
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, user, profile: staff } = await requireStaff();
    if (!staff) return { error: "This is available to coaches and admins only." };

    const { data: row } = await supabase
      .from("ai_artefacts")
      .select("id, subject_type, subject_id, academy_id")
      .eq("id", artefactId)
      .maybeSingle();
    if (!row) return { error: "That result no longer exists." };

    if (row.academy_id !== staff.academy_id) return { error: "That result no longer exists." };
    if (row.subject_type === "player") {
      if (!(await coachesPlayer(supabase, { userId: user.id, role: staff.role, playerId: row.subject_id }))) {
        return { error: "You don't coach this player." };
      }
    }

    const { error } = await supabase
      .from("ai_artefacts")
      .update(
        feedback
          ? { feedback, feedback_by: user.id, feedback_at: new Date().toISOString() }
          : { feedback: null, feedback_by: null, feedback_at: null }
      )
      .eq("id", artefactId);
    if (error) return { error: "Couldn't save your feedback." };
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "setAiArtefactFeedback" });
    return { error: "Couldn't save your feedback." };
  }
}
