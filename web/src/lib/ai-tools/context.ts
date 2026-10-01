import type { SupabaseClient } from "@supabase/supabase-js";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isStaffRole } from "@/lib/auth-guards";
import type { UserRole } from "@/lib/types";
import type { AgentToolContext } from "./types";

export interface AgentTeam {
  id: string;
  name: string;
  ageGroup: string | null;
}

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
): Promise<(AgentToolContext & { teams: AgentTeam[] }) | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, academy_id")
    .eq("id", userId)
    .single();
  if (!profile || !isStaffRole(profile.role)) return null;
  const role = profile.role as UserRole;
  const academyId = (profile.academy_id as string | null) ?? null;

  let teams: AgentTeam[] = [];
  if (role === "admin") {
    if (academyId) {
      const { data } = await supabase.from("teams").select("id, name, age_group").eq("academy_id", academyId).eq("active", true);
      teams = toTeams(data);
    }
  } else {
    const ids = await getCoachedTeamIds(supabase, userId);
    if (ids.length) {
      const { data } = await supabase.from("teams").select("id, name, age_group").in("id", ids);
      teams = toTeams(data);
    }
  }

  return { supabase, userId, role, academyId, teamIds: teams.map((t) => t.id), teams };
}

function toTeams(rows: unknown): AgentTeam[] {
  return ((rows ?? []) as { id: string; name: string; age_group: string | null }[]).map((t) => ({
    id: t.id,
    name: t.name,
    ageGroup: t.age_group ?? null,
  }));
}
