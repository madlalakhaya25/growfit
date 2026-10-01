import { canActOnPlayer } from "@/lib/auth-guards";
import type { AgentToolContext } from "./types";

export const DEFAULT_MAX_ROWS = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Plain object guard for `parseInput` — model args arrive as `unknown`. */
export function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

/** Integer in [min, max], or `fallback` when absent. `undefined` means invalid. */
export function boundedInt(
  v: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number }
): number | undefined {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

/**
 * The team ids a team-scoped tool may read: the caller's own, narrowed to the
 * one the model asked for. A requested team outside `ctx.teamIds` yields an
 * empty list — the same as "no such team" — so a model that guesses another
 * team's id learns nothing.
 */
export function scopedTeamIds(ctx: AgentToolContext, requested?: string): string[] {
  if (!requested) return ctx.teamIds;
  return ctx.teamIds.includes(requested) ? [requested] : [];
}

/**
 * Per-player authorisation. RLS is NOT this boundary (`player_academy_read`,
 * migration 001, is academy-wide), so every player-scoped tool calls this
 * before reading anything. Fails closed on any query error.
 */
export async function authorisePlayer(
  ctx: AgentToolContext,
  playerId: string
): Promise<{ academyId: string; position: string | null; fullName: string } | null> {
  const [{ data: player, error: pErr }, { data: memberships, error: mErr }] = await Promise.all([
    ctx.supabase
      .from("players")
      .select("academy_id, position, full_name")
      .eq("id", playerId)
      .single(),
    ctx.supabase.from("team_members").select("team_id").eq("player_id", playerId).eq("active", true),
  ]);
  if (pErr || mErr || !player) return null;
  const ok = canActOnPlayer({
    role: ctx.role,
    userAcademyId: ctx.academyId,
    playerAcademyId: (player.academy_id as string | null) ?? null,
    coachedTeamIds: ctx.teamIds,
    playerTeamIds: ((memberships ?? []) as { team_id: string }[]).map((m) => m.team_id),
  });
  if (!ok) return null;
  return {
    academyId: player.academy_id as string,
    position: (player.position as string | null) ?? null,
    fullName: player.full_name as string,
  };
}

export const NOT_YOUR_PLAYER = { error: "That player isn't on a team you can access." } as const;

/**
 * Where a row lives, by role. Admins and coaches have separate route trees;
 * a link to the wrong tree would bounce the user, so a row with no sensible
 * destination for the role gets no link at all.
 */
export function playerHref(ctx: AgentToolContext, playerId: string): string | undefined {
  if (ctx.role === "admin") return `/dashboard/admin/players/${playerId}`;
  if (ctx.role === "coach") return `/dashboard/coach/squad/${playerId}`;
  return undefined;
}

export function fixtureHref(ctx: AgentToolContext, fixtureId: string): string | undefined {
  return ctx.role === "coach" ? `/dashboard/coach/fixtures/${fixtureId}` : undefined;
}
