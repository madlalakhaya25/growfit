"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { MAX_MATCH_MINUTES } from "@/lib/match-minutes";

export type MinutesEntry = { playerId: string; minutes: number };

/**
 * Save the minutes each child actually played in a fixture, from the match-day
 * playing-time screen. Writes one match_appearances row per child (upsert), so
 * saving twice corrects rather than duplicates. A child who was in the squad
 * but did not get on is saved as 0 minutes and "not played".
 */
export async function saveMatchMinutes(
  fixtureId: string,
  entries: MinutesEntry[],
): Promise<{ success?: boolean; count?: number; error?: string }> {
  if (!Array.isArray(entries) || entries.length === 0) return { error: "There are no minutes to save yet." };
  if (entries.length > 40) return { error: "That is more players than a squad can have." };
  const ids = new Set(entries.map((e) => e.playerId));
  if (ids.size !== entries.length) return { error: "A player is listed twice. Reload the page and try again." };
  const badMinutes = entries.some(
    (e) => typeof e.playerId !== "string" || !Number.isInteger(e.minutes) || e.minutes < 0 || e.minutes > MAX_MATCH_MINUTES,
  );
  if (badMinutes) return { error: "Some of the minutes look wrong. Check them and try again." };

  const { supabase, user } = await requireUser();
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id, team_id")
    .eq("id", fixtureId)
    .in("team_id", await getCoachedTeamIds(supabase, user.id))
    .single();
  if (!fixture) return { error: "Fixture not found or access denied." };

  const { data: members } = await supabase
    .from("team_members")
    .select("player_id")
    .eq("team_id", fixture.team_id)
    .eq("active", true)
    .in("player_id", [...ids]);
  const memberIds = new Set(((members ?? []) as { player_id: string }[]).map((m) => m.player_id));
  if (entries.some((e) => !memberIds.has(e.playerId))) {
    return { error: "Someone in this list is no longer in the squad. Reload the page and try again." };
  }

  const rows = entries.map((e) => ({
    fixture_id: fixtureId,
    player_id: e.playerId,
    played: e.minutes > 0,
    minutes_played: e.minutes,
  }));
  const { error } = await supabase.from("match_appearances").upsert(rows, { onConflict: "fixture_id,player_id" });
  if (error) {
    if (error.code === "PGRST204" || error.code === "42703") {
      return { error: "Saving minutes needs a database update that hasn't been run yet. Ask your academy admin to run migration 062." };
    }
    return { error: friendlyError(error) };
  }
  revalidatePath(`/dashboard/coach/fixtures/${fixtureId}`);
  revalidatePath("/dashboard/coach/squad", "layout");
  return { success: true, count: rows.length };
}
