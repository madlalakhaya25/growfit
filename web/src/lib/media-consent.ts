// The consent gate for footage of children (docs/AI_AND_UX_PLAN_2026.md step
// 5.0). Every child shown in a clip must have photo and media consent for the
// current season before the clip is analysed. The decision is made in the
// database by clip_consent_gaps (migration 059); this wraps it so a caller
// cannot get a "yes" any other way.
//
// Fails closed everywhere: no children named, a read error, or the function
// not being installed yet all mean "blocked", never "allowed". A video action
// must call checkClipConsent itself and stop on `ok: false`; a screen hiding a
// button is not the gate.

import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSeason } from "@/lib/development-categories";

export type ConsentBlockReason = "no_players" | "missing_consent" | "not_installed" | "unreadable";

export type ConsentGate =
  | { ok: true }
  | { ok: false; reason: ConsentBlockReason; blockedPlayerIds: string[] };

const missingFunction = (e: { code?: string } | null | undefined) => e?.code === "42883" || e?.code === "PGRST202";

/** Is every child in `playerIds` cleared for footage this season? */
export async function checkClipConsent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerIds: readonly string[],
  now: Date = new Date(),
): Promise<ConsentGate> {
  const ids = [...new Set(playerIds)];
  if (ids.length === 0) return { ok: false, reason: "no_players", blockedPlayerIds: [] };

  const { data, error } = await supabase.rpc("clip_consent_gaps", { p_player_ids: ids, p_season: currentSeason(now) });
  if (error) return { ok: false, reason: missingFunction(error) ? "not_installed" : "unreadable", blockedPlayerIds: ids };
  if (!Array.isArray(data)) return { ok: false, reason: "unreadable", blockedPlayerIds: ids };

  const gaps = (data as unknown[]).filter((v): v is string => typeof v === "string");
  // Only ids we asked about count, and a gap list shorter than expected is no proof of consent.
  const blocked = ids.filter((id) => gaps.includes(id));
  return blocked.length === 0 ? { ok: true } : { ok: false, reason: "missing_consent", blockedPlayerIds: blocked };
}

/** What to tell a coach when the gate says no. Names the children, never the form's contents. */
export function consentBlockMessage(gate: Extract<ConsentGate, { ok: false }>, namesById: ReadonlyMap<string, string>): string {
  switch (gate.reason) {
    case "no_players":
      return "Say which players are in the clip first.";
    case "not_installed":
      return "Footage checks need a database update that hasn't been run yet. Ask your academy admin to run migration 059.";
    case "unreadable":
      return "Couldn't check consent just now, so nothing was sent. Try again.";
    case "missing_consent": {
      const names = gate.blockedPlayerIds.map((id) => namesById.get(id)?.split(/\s+/)[0] ?? "A player");
      const list = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
      return `Photo and media consent is missing for ${list} this season. Ask their parents to confirm it before using this clip.`;
    }
  }
}
