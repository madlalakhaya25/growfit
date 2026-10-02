"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { loadWelfareAlerts, type WelfareAlert } from "@/lib/welfare-alerts";

export type { WelfareAlert };

/** Players across every team this coach coaches who are below the 75% training attendance threshold. */
export async function getWelfareAlerts(): Promise<{ alerts: WelfareAlert[] } | { error: string }> {
  const { supabase, user } = await requireUser();
  return loadWelfareAlerts(supabase, await getCoachedTeamIds(supabase, user.id));
}

export async function logWelfareCheckin(
  playerId: string,
  attendancePctAtCheckin: number,
  note: string
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("welfare_checkins").insert({
    player_id: playerId,
    noted_by: user.id,
    attendance_pct: attendancePctAtCheckin,
    note: note.trim() || null,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/coach", "page");
  return { success: true };
}
