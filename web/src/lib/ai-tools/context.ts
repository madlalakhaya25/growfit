import type { SupabaseClient } from "@supabase/supabase-js";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isStaffRole } from "@/lib/auth-guards";
import type { UserRole } from "@/lib/types";
import type { AgentToolContext } from "./types";

/**
 * Builds the tool context for the signed-in user, or null when they are not
 * staff. A coach's `teamIds` are the teams they coach; an admin's are every
 * active team in their academy (the admin sees the whole academy, and the
 * tools' per-player check still requires the same academy).
 */
export async function buildAgentContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<(AgentToolContext & { teams: { id: string; name: string }[] }) | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, academy_id")
    .eq("id", userId)
    .single();
  if (!profile || !isStaffRole(profile.role)) return null;
  const role = profile.role as UserRole;
  const academyId = (profile.academy_id as string | null) ?? null;

  let teams: { id: string; name: string }[] = [];
  if (role === "admin") {
    if (academyId) {
      const { data } = await supabase.from("teams").select("id, name").eq("academy_id", academyId).eq("active", true);
      teams = (data ?? []) as { id: string; name: string }[];
    }
  } else {
    const ids = await getCoachedTeamIds(supabase, userId);
    if (ids.length) {
      const { data } = await supabase.from("teams").select("id, name").in("id", ids);
      teams = (data ?? []) as { id: string; name: string }[];
    }
  }

  return { supabase, userId, role, academyId, teamIds: teams.map((t) => t.id), teams };
}
