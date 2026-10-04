"use server";
import { revalidatePath } from "next/cache";
import { requireStaff, requireUser } from "@/lib/auth";
import { coachesPlayer } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { isMissingPositionsTable, type PositionKind } from "@/lib/player-positions";
import { validateSlots } from "@/lib/player-roles";

async function replaceSlots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  playerId: string,
  kind: PositionKind,
  slots: { position: string; role: string | null }[]
): Promise<string | null> {
  const { error: delError } = await supabase.from("player_positions").delete().eq("player_id", playerId).eq("kind", kind);
  if (delError) return isMissingPositionsTable(delError) ? "Positions need a database update first. Tell your admin." : friendlyError(delError);
  const rows = slots.map((s, i) => ({ player_id: playerId, kind, rank: i + 1, position: s.position, role: s.role, set_by: userId, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("player_positions").insert(rows);
  return error ? friendlyError(error) : null;
}

/** The coach's official positions and roles. Also keeps players.position and
 * secondary_pos equal to ranks 1 and 2, the fallback every other screen reads. */
export async function setOfficialPositions(playerId: string, raw: unknown): Promise<{ error?: string; success?: boolean }> {
  const { supabase, user, profile } = await requireStaff();
  if (!profile) return { error: "Only coaches and admins can set a player's position." };
  if (!(await coachesPlayer(supabase, { userId: user.id, role: profile.role, playerId }))) {
    return { error: "You can only set positions for players on a team you coach." };
  }
  const parsed = validateSlots(raw);
  if (!parsed.ok) return { error: parsed.error };

  const failed = await replaceSlots(supabase, user.id, playerId, "official", parsed.slots);
  if (failed) return { error: failed };

  const { error } = await supabase
    .from("players")
    .update({ position: parsed.slots[0].position, secondary_pos: parsed.slots[1]?.position ?? null })
    .eq("id", playerId);
  if (error) return { error: friendlyError(error) };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}

/** Where a player (or their parent) likes to play. Never changes team sheets. */
export async function setPreferredPositions(playerId: string, raw: unknown): Promise<{ error?: string; success?: boolean }> {
  const { supabase, user } = await requireUser();
  const [{ data: own }, { data: link }] = await Promise.all([
    supabase.from("players").select("id").eq("id", playerId).eq("profile_id", user.id).maybeSingle(),
    supabase.from("parent_player_links").select("player_id").eq("player_id", playerId).eq("parent_id", user.id).maybeSingle(),
  ]);
  if (!own && !link) return { error: "You can only choose positions for yourself or your child." };
  const parsed = validateSlots(raw);
  if (!parsed.ok) return { error: parsed.error };

  const failed = await replaceSlots(supabase, user.id, playerId, "preferred", parsed.slots);
  if (failed) return { error: failed };

  revalidatePath("/dashboard/player");
  revalidatePath(`/dashboard/parent/${playerId}`);
  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  return { success: true };
}
