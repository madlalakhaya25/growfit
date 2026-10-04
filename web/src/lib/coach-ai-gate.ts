import { checkAiBudget } from "@/lib/ai-guard";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";

/**
 * Who may spend an AI call on a team: the signed-in user must coach it (not
 * redundant with RLS, which is academy-wide) and be under their hourly AI
 * budget. Resolves to the team's age group (U15 when none is set), or the
 * message to show. One call against the budget counts attempts, not
 * successes: a failed call still costs a request to the provider.
 */
export async function gateCoachAi(teamId: string): Promise<{ error: string } | { ageGroup: string }> {
  const { supabase, user } = await requireUser();
  const { data: team } = await supabase
    .from("teams")
    .select("id, age_group")
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .single();
  if (!team) return { error: "You don't coach this team." };
  const overBudget = await checkAiBudget(user.id);
  if (overBudget) return { error: overBudget };
  return { ageGroup: ((team.age_group as string | null) ?? "").trim() || "U15" };
}
