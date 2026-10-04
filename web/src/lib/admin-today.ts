// What the admin's Today page says about registration (docs/AI_AND_UX_PLAN_2026.md
// section 6). The six documents per player are already counted by the funnel; this
// only rolls them up per team so the director sees which squad to chase first.
// Pure, so the same data always gives the same page.

import { DOCUMENTS, isDocComplete } from "@/lib/document-definitions";

export interface TodayPlayer {
  id: string;
  /** The player's active team, or null if they are not on one. */
  teamId: string | null;
  /** document_type to status, for the current season. */
  docStatus: ReadonlyMap<string, string>;
}

export interface TodayTeam {
  id: string;
  name: string;
  ageGroup: string | null;
}

export interface TeamCompliance {
  teamId: string;
  name: string;
  ageGroup: string | null;
  players: number;
  /** Players with all six documents in. */
  complete: number;
  /** Documents still outstanding, summed over the team's players. */
  missingDocs: number;
}

export interface ComplianceSummary {
  players: number;
  complete: number;
  /** Whole percent of players fully registered; 0 for an empty academy. */
  pct: number;
  /** Teams with at least one player, the most outstanding documents first. */
  byTeam: TeamCompliance[];
}

/** How many of the six required documents this player has not finished. */
export function missingDocCount(docStatus: ReadonlyMap<string, string>): number {
  return DOCUMENTS.filter((d) => !isDocComplete(d, docStatus.get(d.type))).length;
}

export function summariseCompliance(players: TodayPlayer[], teams: TodayTeam[]): ComplianceSummary {
  const rows = new Map<string, TeamCompliance>(
    teams.map((t) => [t.id, { teamId: t.id, name: t.name, ageGroup: t.ageGroup, players: 0, complete: 0, missingDocs: 0 }]),
  );
  let complete = 0;
  for (const p of players) {
    const missing = missingDocCount(p.docStatus);
    if (missing === 0) complete += 1;
    const row = p.teamId ? rows.get(p.teamId) : undefined;
    if (!row) continue;
    row.players += 1;
    row.missingDocs += missing;
    if (missing === 0) row.complete += 1;
  }
  const byTeam = [...rows.values()]
    .filter((r) => r.players > 0)
    .sort((a, b) => b.missingDocs - a.missingDocs || a.name.localeCompare(b.name));
  return {
    players: players.length,
    complete,
    pct: players.length === 0 ? 0 : Math.round((complete / players.length) * 100),
    byTeam,
  };
}
