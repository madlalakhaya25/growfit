// This week's compliance chase (docs/AI_AND_UX_PLAN_2026.md step 4.9).
//
// The funnel (BACKLOG 2.2) and the eligibility checks (2.4) already know what is
// wrong; this module only orders it and words the reminder. It is pure and
// deterministic on purpose: no player data goes to a model, the same week always
// gives the same list, and the message a parent receives is exactly what the
// admin saw before copying it. Nothing here is sent anywhere.

import { DOCUMENTS, isDocComplete } from "@/lib/document-definitions";

export interface ChasePlayer {
  id: string;
  name: string;
  ageGroup: string | null;
  /** The player's registration number with SAFA (MYSAFA), if on file. */
  safaNumber: string | null;
  /** document_type to status, for the current season. */
  docStatus: Map<string, string>;
  /** Kick-off of this player's team's next fixture, ISO, or null. */
  nextFixture: string | null;
}

export interface ChaseFlags {
  /** Player ids flagged outside their age band (lib/eligibility). */
  overage: ReadonlySet<string>;
  /** Player ids sharing an identifying field with another player. */
  duplicate: ReadonlySet<string>;
}

export type ChaseReason = "no-safa" | "documents" | "age" | "duplicate";

export interface ChaseItem {
  playerId: string;
  name: string;
  ageGroup: string | null;
  reasons: ChaseReason[];
  missingDocs: string[];
  /** Whole days to the next fixture when it is within the chase window. */
  fixtureInDays: number | null;
  /** Higher chases first. */
  score: number;
  message: string;
}

/** A fixture this close makes a gap urgent: registration is checked at the match. */
export const URGENT_DAYS = 7;
const DAY_MS = 86_400_000;

/** Days from `now` to the fixture, rounded up, or null if it is past or beyond the window. */
export function daysToFixture(fixtureIso: string | null, now: Date): number | null {
  if (!fixtureIso) return null;
  const ms = new Date(fixtureIso).getTime() - now.getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const days = Math.ceil(ms / DAY_MS);
  return days <= URGENT_DAYS ? days : null;
}

function whenWords(days: number): string {
  if (days <= 1) return "tomorrow";
  return `in ${days} days`;
}

/**
 * The reminder, in the voice the academy already uses. Names the player and what
 * is missing and nothing more: no ID numbers, no medical detail, no mention of an
 * age or duplicate flag (those are for the admin to check first, not to put to a
 * parent as an accusation).
 */
export function chaseMessage(
  item: Pick<ChaseItem, "name" | "missingDocs" | "reasons" | "fixtureInDays">,
  academyName: string,
  season: string,
): string {
  const asks = [...item.missingDocs];
  if (item.reasons.includes("no-safa")) asks.push("their SAFA registration number");
  if (asks.length === 0) return "";
  const list = asks.length === 1 ? asks[0] : `${asks.slice(0, -1).join(", ")} and ${asks.at(-1)}`;
  const urgency = item.fixtureInDays === null
    ? ""
    : ` They play ${whenWords(item.fixtureInDays)}, and we can't field a player who isn't fully registered.`;
  return (
    `Hi! Following up on ${item.name}'s registration with ${academyName} for the ${season} season. ` +
    `We're still missing: ${list}.${urgency} Please let me know if you have any questions. Thank you!`
  );
}

function reasonsFor(p: ChasePlayer, missingDocs: string[], flags: ChaseFlags): ChaseReason[] {
  const reasons: ChaseReason[] = [];
  if (!p.safaNumber?.trim()) reasons.push("no-safa");
  if (missingDocs.length > 0) reasons.push("documents");
  if (flags.overage.has(p.id)) reasons.push("age");
  if (flags.duplicate.has(p.id)) reasons.push("duplicate");
  return reasons;
}

/** Whether a parent can fix it (as against a check only the admin can make). */
const isParentGap = (reasons: ChaseReason[]) => reasons.includes("no-safa") || reasons.includes("documents");

function scoreOf(reasons: ChaseReason[], missingCount: number, fixtureInDays: number | null): number {
  const weights: [boolean, number][] = [
    [fixtureInDays !== null, 1000 - (fixtureInDays ?? 0)],
    [reasons.includes("no-safa"), 100],
    [reasons.includes("age"), 5],
    [reasons.includes("duplicate"), 5],
  ];
  return weights.reduce((sum, [on, w]) => sum + (on ? w : 0), missingCount * 10);
}

/**
 * Everyone who needs chasing, most urgent first. Urgency is, in order: a gap with
 * a fixture inside the week (a forfeit), then no SAFA number, then the number of
 * documents outstanding. Players with only an age or duplicate flag are listed
 * last, with no message: those are checks for the admin, not a parent's job.
 * Ties break on name so the order never shuffles between loads.
 */
export function buildChase(
  players: ChasePlayer[],
  flags: ChaseFlags,
  academyName: string,
  season: string,
  now: Date,
): ChaseItem[] {
  const items: ChaseItem[] = [];
  for (const p of players) {
    const missingDocs = DOCUMENTS.filter((d) => !isDocComplete(d, p.docStatus.get(d.type))).map((d) => d.label);
    const reasons = reasonsFor(p, missingDocs, flags);
    if (reasons.length === 0) continue;
    const parentGap = isParentGap(reasons);
    const fixtureInDays = parentGap ? daysToFixture(p.nextFixture, now) : null;
    const item: ChaseItem = {
      playerId: p.id, name: p.name, ageGroup: p.ageGroup, reasons, missingDocs, fixtureInDays,
      score: scoreOf(reasons, missingDocs.length, fixtureInDays), message: "",
    };
    if (parentGap) item.message = chaseMessage(item, academyName, season);
    items.push(item);
  }
  return items.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
