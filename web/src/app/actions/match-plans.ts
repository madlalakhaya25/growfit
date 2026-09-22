"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";

/**
 * Confirm the caller coaches this team, and resolve its academy.
 *
 * Not redundant with RLS: `fixture_match_plans_staff_all` (migration 041)
 * only checks `is_admin_or_coach()` + academy match, not which team a coach
 * specifically coaches — RLS here is deliberately academy-wide, not
 * per-team, per docs/BACKLOG.md 1.5's finding — so this app-level filter is
 * the only thing stopping one coach from writing another coach's match
 * plan. Same shape as tactic-plays.ts's own requireCoachTeam.
 */
async function requireCoachTeam(teamId: string) {
  const { supabase, user } = await requireUser();
  const { data: team } = await supabase
    .from("teams")
    .select("id, academy_id")
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .single();
  return { supabase, user, team };
}

/**
 * Save (or overwrite-in-place — no history/versioning, confirmed decision)
 * the applied match plan for a fixture. `fixture_id` is UNIQUE on
 * fixture_match_plans, so this is always an upsert, matching tactic_plays'
 * own upsert-on-playId convention. Once applied, this is an ordinary row a
 * coach can edit like any other — no "AI-generated" provenance flag.
 */
export async function saveMatchPlan(input: {
  fixtureId: string;
  teamId: string;
  data: unknown;
}): Promise<{ id?: string; error?: string }> {
  const { supabase, user, team } = await requireCoachTeam(input.teamId);
  if (!team) return { error: "You don't coach this team." };

  // fixture_match_plans' own RLS is the same academy-wide shape as
  // tactic_plays' — it doesn't tie fixture_id to team_id either — so this
  // is the boundary that stops a coach saving a plan against a fixture
  // that isn't even theirs.
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id")
    .eq("id", input.fixtureId)
    .eq("team_id", input.teamId)
    .single();
  if (!fixture) return { error: "Fixture not found." };

  const { data, error } = await supabase
    .from("fixture_match_plans")
    .upsert(
      {
        academy_id: team.academy_id,
        fixture_id: input.fixtureId,
        team_id: team.id,
        coach_id: user.id,
        data: input.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fixture_id" }
    )
    .select("id")
    .single();

  if (error || !data) return { error: error ? friendlyError(error) : "Could not save the match plan." };
  revalidatePath("/dashboard/coach/assistant");
  return { id: data.id };
}
