"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPlayerSchema, createTeamSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";

async function getCoachTeamById(teamId: string) {
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

export async function addPlayerToSquad(playerId: string, teamId: string) {
  const { supabase, team } = await getCoachTeamById(teamId);
  if (!team) return { error: "No team found." };

  const { error } = await supabase
    .from("team_members")
    .upsert({ team_id: team.id, player_id: playerId, active: true }, { onConflict: "team_id,player_id" });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach/squad", "page");
  return { success: true };
}

export async function removePlayerFromSquad(playerId: string, teamId: string) {
  const { supabase, team } = await getCoachTeamById(teamId);
  if (!team) return { error: "No team found." };

  const { error } = await supabase
    .from("team_members")
    .update({ active: false })
    .eq("team_id", team.id)
    .eq("player_id", playerId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/coach/squad", "page");
  return { success: true };
}

export async function createPlayer(formData: FormData) {
  const teamId = formData.get("team_id") as string;
  const { supabase, team } = await getCoachTeamById(teamId);
  if (!team) return { error: "No team found." };

  const num = (key: string) => {
    const v = formData.get(key);
    return v !== null && v !== "" ? Number(v) : undefined;
  };
  const raw = {
    full_name: formData.get("full_name") as string,
    date_of_birth: (formData.get("date_of_birth") as string) || undefined,
    position: (formData.get("position") as string) || undefined,
    preferred_foot: (formData.get("preferred_foot") as string) || undefined,
    pace:      num("pace"),
    shooting:  num("shooting"),
    passing:   num("passing"),
    dribbling: num("dribbling"),
    defending: num("defending"),
    physical:  num("physical"),
  };

  const parsed = createPlayerSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const { data: player, error: createErr } = await supabase
    .from("players")
    .insert({ ...parsed.data, academy_id: team.academy_id })
    .select("id")
    .single();

  if (createErr || !player) return { error: createErr?.message ?? "Could not create player." };

  const { error: memberErr } = await supabase
    .from("team_members")
    .insert({ team_id: team.id, player_id: player.id });

  if (memberErr) return { error: memberErr.message };

  revalidatePath("/dashboard/coach/squad", "page");
  redirect("/dashboard/coach/squad");
}

export async function updateTeam(teamId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = {
    name: formData.get("name") as string,
    age_group: (formData.get("age_group") as string) || undefined,
  };
  const parsed = createTeamSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const { error } = await supabase
    .from("teams")
    .update(parsed.data)
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id));

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/teams");
  revalidatePath("/dashboard/coach");
  return { success: true };
}

export async function deleteTeam(teamId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("teams")
    .update({ active: false })
    .eq("id", teamId)
    .in("id", await getCoachedTeamIds(supabase, user.id));

  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/teams");
  revalidatePath("/dashboard/coach");
  redirect("/dashboard/admin/teams");
}

export async function createTeam(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id) return { error: "No academy linked." };

  const raw = {
    name: formData.get("name") as string,
    age_group: (formData.get("age_group") as string) || undefined,
  };

  const parsed = createTeamSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  const { data: team, error } = await supabase
    .from("teams")
    .insert({ ...parsed.data, academy_id: profile.academy_id, coach_id: user.id })
    .select("id")
    .single();

  // A trigger adds the creator to team_coaches — every "my teams" query reads
  // that roster, and RLS there is admin-only, so the database handles it.
  if (error || !team) return { error: error?.message ?? "Could not create the team." };
  revalidatePath("/dashboard/coach");
  redirect("/dashboard/coach");
}

export async function joinByInviteCode(inviteCode: string) {
  const { supabase, user } = await requireUser();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("invite_code", inviteCode.toUpperCase())
    .eq("active", true)
    .single();

  if (!team) return { error: "Team not found. Check the invite code and try again." };

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
    .single();

  if (!player) return { error: "No player profile found. Ask your coach to create your profile first." };

  const { data: existing } = await supabase
    .from("team_members")
    .select("id, active")
    .eq("team_id", team.id)
    .eq("player_id", player.id)
    .maybeSingle();

  if (existing?.active) return { error: "You are already a member of this team.", teamName: team.name };

  if (existing && !existing.active) {
    await supabase.from("team_members").update({ active: true }).eq("id", existing.id);
  } else {
    await supabase.from("team_members").insert({ team_id: team.id, player_id: player.id });
  }

  revalidatePath("/dashboard/player", "page");
  return { success: true, teamName: team.name };
}

/** Join a team using the coach code an admin gave you. */
export async function claimTeamByCoachCode(code: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("claim_team_by_coach_code", { p_code: code });
  if (error) return { error: error.message };
  const res = data as { error?: string; team_name?: string; already?: boolean; is_head?: boolean };
  if (res?.error) return { error: res.error };

  revalidatePath("/dashboard/coach", "layout");
  return {
    success: true,
    teamName: res.team_name,
    already: res.already ?? false,
    isHead: res.is_head ?? false,
  };
}

/** Admin: rotate a team's coach code. */
export async function resetTeamCoachCode(teamId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("reset_team_coach_code", { p_team_id: teamId });
  if (error) return { error: error.message };
  const res = data as { error?: string; coach_code?: string };
  if (res?.error) return { error: res.error };
  revalidatePath("/dashboard/admin/teams");
  return { success: true, coachCode: res.coach_code };
}

/** Admin: take a coach off a team. */
export async function removeTeamCoach(teamId: string, coachId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("remove_team_coach", {
    p_team_id: teamId,
    p_coach_id: coachId,
  });
  if (error) return { error: error.message };
  const res = data as { error?: string };
  if (res?.error) return { error: res.error };
  revalidatePath("/dashboard/admin/teams");
  return { success: true };
}

/** Admin: players in the academy who are not in any active squad. */
export async function listUnassignedPlayers(): Promise<{
  players?: { id: string; full_name: string; position: string | null; date_of_birth: string | null; mysafa_number: string | null }[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id) return { error: "No academy linked." };
  if (!["admin", "coach"].includes(profile.role)) return { error: "Not allowed." };

  const [{ data: players }, { data: memberships }] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, position, date_of_birth, mysafa_number")
      .eq("academy_id", profile.academy_id)
      .eq("active", true)
      .order("full_name"),
    supabase.from("team_members").select("player_id").eq("active", true),
  ]);

  const inSquad = new Set((memberships ?? []).map((m: { player_id: string }) => m.player_id));
  return {
    players: ((players ?? []) as { id: string; full_name: string; position: string | null; date_of_birth: string | null; mysafa_number: string | null }[])
      .filter((p) => !inSquad.has(p.id)),
  };
}

/** Admin: put existing academy players into a squad. */
export async function assignPlayersToTeam(input: { teamId: string; playerIds: string[] }) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id) return { error: "No academy linked." };
  if (!["admin", "coach"].includes(profile.role)) return { error: "Not allowed." };
  if (input.playerIds.length === 0) return { error: "Pick at least one player." };

  // The team must belong to the caller's academy.
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", input.teamId)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .single();
  if (!team) return { error: "Team not found in your academy." };

  const { error } = await supabase
    .from("team_members")
    .upsert(
      input.playerIds.map((player_id) => ({ team_id: team.id, player_id, active: true })),
      { onConflict: "team_id,player_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/admin/players");
  revalidatePath("/dashboard/coach/squad");
  return { success: true, count: input.playerIds.length };
}
