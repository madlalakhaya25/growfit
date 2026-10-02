import type { SupabaseClient } from "@supabase/supabase-js";

export type FamilyMessageKind = "match_story" | "weekly_digest";
export const FAMILY_BODY_MAX = 1500;

export interface FamilyMessage {
  id: string;
  playerId: string;
  kind: FamilyMessageKind;
  refKey: string;
  body: string;
  status: "draft" | "approved";
  approvedByName: string | null;
  createdAt: string;
}

/** A missing table is "not available yet", never an error on a coach's or parent's screen. */
export function isMissingFamilyTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

type Row = {
  id: string; player_id: string; kind: FamilyMessageKind; ref_key: string; body: string;
  status: "draft" | "approved"; approved_by_name: string | null; created_at: string;
};
const COLUMNS = "id, player_id, kind, ref_key, body, status, approved_by_name, created_at";

const toMessage = (r: Row): FamilyMessage => ({
  id: r.id, playerId: r.player_id, kind: r.kind, refKey: r.ref_key, body: r.body,
  status: r.status, approvedByName: r.approved_by_name, createdAt: r.created_at,
});

/** Every story for one match, for the coach: drafts and approved. */
export async function loadFixtureStories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  fixtureId: string,
): Promise<{ available: boolean; byPlayer: Map<string, FamilyMessage> }> {
  const { data, error } = await supabase
    .from("family_messages").select(COLUMNS).eq("kind", "match_story").eq("ref_key", fixtureId);
  const byPlayer = new Map<string, FamilyMessage>();
  if (error) return { available: !isMissingFamilyTable(error), byPlayer };
  for (const r of (data ?? []) as Row[]) byPlayer.set(r.player_id, toMessage(r));
  return { available: true, byPlayer };
}

/** This week's notes for some children, for the coach: drafts and shared. */
export async function loadWeekDigests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerIds: string[],
  weekKey: string,
): Promise<{ available: boolean; byPlayer: Map<string, FamilyMessage> }> {
  const byPlayer = new Map<string, FamilyMessage>();
  if (playerIds.length === 0) return { available: true, byPlayer };
  const { data, error } = await supabase
    .from("family_messages").select(COLUMNS).eq("kind", "weekly_digest").eq("ref_key", weekKey).in("player_id", playerIds);
  if (error) return { available: !isMissingFamilyTable(error), byPlayer };
  for (const r of (data ?? []) as Row[]) byPlayer.set(r.player_id, toMessage(r));
  return { available: true, byPlayer };
}

/**
 * What a family can read about one child: approved messages only, newest first.
 * RLS already hides drafts from a player or parent; the filter is here as well so
 * a coach opening a child's page never sees a draft dressed as a family message.
 */
export async function loadApprovedMessages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string,
  limit = 5,
): Promise<FamilyMessage[]> {
  const { data, error } = await supabase
    .from("family_messages")
    .select(COLUMNS)
    .eq("player_id", playerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as Row[]).map(toMessage);
}
