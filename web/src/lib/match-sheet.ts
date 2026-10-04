// The rows and plan for a printable team sheet (before a match) or match
// report (after it), borrowed from Finalthird's lineup and report export.
// Pure: the print page gathers the data, this decides order and what shows.

import { POSITIONS } from "@/lib/types";

export interface SheetPlayer {
  id: string;
  full_name: string;
  position: string | null;
}

export interface SheetRow {
  id: string;
  name: string;
  /** Short position code, e.g. "CB", or "" when unknown. */
  position: string;
  /** "Injured" / "Unavailable", or null when available. */
  availability: string | null;
  /** After the match only: null when no appearance was logged for this child. */
  played: boolean | null;
  rating: number | null;
  note: string | null;
}

const POSITION_ORDER = new Map(POSITIONS.map((p, i) => [p.value as string, i]));

/** "Centre Back (CB)" → "CB"; unknown values pass through upper-cased. */
export function positionCode(position: string | null): string {
  if (!position) return "";
  const label = POSITIONS.find((p) => p.value === position)?.label;
  return /\(([^)]+)\)\s*$/.exec(label ?? "")?.[1] ?? position.toUpperCase();
}

/**
 * One row per squad player. Before the match: available players first, then
 * goalkeeper to forward, then name. After it: those who played first, in the
 * same position order. Players who appeared but have since left the squad
 * still get a row, since the report is a record of the day.
 */
export function buildSheetRows(input: {
  squad: SheetPlayer[];
  availability: Record<string, { status: string }>;
  appearances?: { player: SheetPlayer; played: boolean }[];
  ratings?: { playerId: string; rating: number; note: string | null }[];
}): SheetRow[] {
  const after = input.appearances !== undefined;
  const byId = new Map<string, SheetPlayer>();
  for (const p of input.squad) byId.set(p.id, p);
  for (const a of input.appearances ?? []) if (!byId.has(a.player.id)) byId.set(a.player.id, a.player);

  const played = new Map((input.appearances ?? []).map((a) => [a.player.id, a.played]));
  const ratings = new Map((input.ratings ?? []).map((r) => [r.playerId, r]));

  const rows: (SheetRow & { order: number })[] = [...byId.values()].map((p) => {
    const status = input.availability[p.id]?.status;
    const rating = ratings.get(p.id);
    return {
      id: p.id,
      name: p.full_name,
      position: positionCode(p.position),
      availability: status && status !== "available" ? (status === "injured" ? "Injured" : "Unavailable") : null,
      played: after ? played.get(p.id) ?? null : null,
      rating: after ? rating?.rating ?? null : null,
      note: after ? rating?.note ?? null : null,
      order: POSITION_ORDER.get(p.position ?? "") ?? POSITIONS.length,
    };
  });

  const first = (r: SheetRow) => (after ? (r.played ? 0 : 1) : r.availability ? 1 : 0);
  rows.sort((a, b) => first(a) - first(b) || a.order - b.order || a.name.localeCompare(b.name));
  return rows.map(({ order: _order, ...r }) => r);
}

export interface SheetPlan {
  summary: string | null;
  shape: string | null;
  inPossession: string[];
  outOfPossession: string[];
  setPieces: { attacking: string; defending: string } | null;
  teamTalk: string[];
}

const text = (v: unknown, max = 400): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap((x) => (text(x, 300) ? [text(x, 300)!] : [])).slice(0, 8) : [];

/**
 * The parts of a saved match plan (fixture_match_plans.data, unvalidated
 * JSONB) worth printing, read defensively. Null when nothing usable is there.
 */
export function readSheetPlan(data: unknown): SheetPlan | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const sp = d.setPieces as Record<string, unknown> | undefined;
  const attacking = text(sp?.attacking);
  const defending = text(sp?.defending);
  const plan: SheetPlan = {
    summary: text(d.planSummary),
    shape: text(d.shapeAndWhy),
    inPossession: list(d.inPossession),
    outOfPossession: list(d.outOfPossession),
    setPieces: attacking || defending ? { attacking: attacking ?? "", defending: defending ?? "" } : null,
    teamTalk: list(d.teamTalk),
  };
  const empty =
    !plan.summary && !plan.shape && !plan.inPossession.length && !plan.outOfPossession.length &&
    !plan.setPieces && !plan.teamTalk.length;
  return empty ? null : plan;
}
