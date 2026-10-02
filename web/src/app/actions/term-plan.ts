"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  teamId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(2).max(120),
  type: z.enum(["general", "technical", "tactical", "fitness", "match_prep", "recovery"]),
  notes: z.string().max(1000),
});

/**
 * Add one session from the term plan to a team's training list. Not a draft
 * in the database (sessions have no draft state): it is an ordinary session the
 * coach can edit or delete, so this adds nothing a coach has not chosen to add,
 * and never a second session on a day the team already trains.
 */
export async function addPlannedSession(input: {
  teamId: string; date: string; title: string; type: string; notes: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: "That session isn't valid." };
    const { supabase, user, profile } = await requireStaff();
    if (!profile) return { error: "Only coaches and admins can do this." };
    if (!(await getCoachedTeamIds(supabase, user.id)).includes(parsed.data.teamId)) return { error: "You don't coach this team." };

    const day = parsed.data.date;
    const { data: onDay } = await supabase
      .from("training_sessions").select("id")
      .eq("team_id", parsed.data.teamId)
      .gte("session_date", `${day}T00:00:00+02:00`).lte("session_date", `${day}T23:59:59+02:00`);
    if ((onDay ?? []).length > 0) return { error: "This team already has a session that day." };

    // Training time isn't recorded anywhere, so a usual 17:00 start is used; the coach edits it on the session.
    const { error } = await supabase.from("training_sessions").insert({
      team_id: parsed.data.teamId, coach_id: user.id, title: parsed.data.title,
      session_date: `${day}T17:00:00+02:00`, location: null, session_type: parsed.data.type, notes: parsed.data.notes,
    });
    if (error) return { error: "Couldn't add the session. Try again." };
    revalidatePath("/dashboard/coach/training", "page");
    revalidatePath("/dashboard/coach/training/term");
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "addPlannedSession" });
    return { error: "Couldn't add the session. Try again." };
  }
}
