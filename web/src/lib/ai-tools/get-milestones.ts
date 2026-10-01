import { loadDevelopmentSnapshot } from "@/lib/development-data";
import { asRecord, authorisePlayer, DEFAULT_MAX_ROWS, isUuid, NOT_YOUR_PLAYER, playerHref } from "./shared";
import type { AgentTool } from "./types";

interface Input { playerId: string }
type Output =
  | { error: string }
  | {
      playerId: string;
      season: string;
      completed: number;
      total: number;
      milestones: { title: string; category: string; completed: boolean }[];
      truncated: boolean;
      loadError: string | null;
      href?: string;
      name: string;
    };

/**
 * Development milestones for the current season. Titles, categories and a
 * completed flag only — the coach's per-milestone note is free text written
 * for staff and stays out of the registry.
 */
export const getMilestones: AgentTool<Input, Output> = {
  name: "getMilestones",
  description: "Returns a player's development milestones this season and which are completed.",
  parameters: {
    type: "object",
    properties: { playerId: { type: "string", description: "The player's id." } },
    required: ["playerId"],
  },
  maxRows: DEFAULT_MAX_ROWS,
  parseInput(raw) {
    const r = asRecord(raw);
    return r && isUuid(r.playerId) ? { playerId: r.playerId } : null;
  },
  async run(ctx, { playerId }) {
    const auth = await authorisePlayer(ctx, playerId);
    if (!auth) return NOT_YOUR_PLAYER;
    const snap = await loadDevelopmentSnapshot(ctx.supabase, {
      playerId,
      academyId: ctx.academyId,
      position: auth.position,
    });
    const all = snap.templates.map((t) => ({
      title: t.title,
      category: t.category,
      completed: snap.completedThisSeason.has(t.id),
    }));
    return {
      playerId,
      name: auth.fullName,
      season: snap.currentSeason,
      completed: all.filter((m) => m.completed).length,
      total: all.length,
      milestones: all.slice(0, getMilestones.maxRows),
      truncated: all.length > getMilestones.maxRows,
      loadError: snap.loadError,
      href: playerHref(ctx, playerId),
    };
  },
  links: (o) => ("href" in o && o.href ? [{ label: o.name, href: o.href, match: [o.name] }] : []),
};
