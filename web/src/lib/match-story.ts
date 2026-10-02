// A short match story for one child's family (docs/AI_AND_UX_PLAN_2026.md step
// 4.6). The platform records a score, the coach's match notes and a rating per
// player, but no scorers or minutes, so this is a warm paragraph and not a
// timeline: it never invents an event. Deterministic on purpose: a coach reads
// and can edit every word before it is approved, and nothing is sent to a
// model. First name only, nothing negative, no comparison with another child.

import { findFlaggedWording } from "@/lib/child-safe-check";

export interface StoryInput {
  firstName: string;
  opponent: string;
  isHome: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
  /** The child's rating for the match, 1 to 5, or null. */
  rating: number | null;
  /** The coach's own words about this child's match (player_ratings.note), or null. */
  coachNote: string | null;
  /** False for a child on the squad who did not get on. */
  played: boolean;
}

export type Outcome = "win" | "draw" | "loss" | "unknown";

export function outcomeOf(team: number | null, opp: number | null): Outcome {
  if (team === null || opp === null) return "unknown";
  if (team > opp) return "win";
  return team === opp ? "draw" : "loss";
}

function resultLine(i: StoryInput): string {
  const where = i.isHome === null ? "" : i.isHome ? " at home" : " away";
  const o = outcomeOf(i.teamScore, i.opponentScore);
  const score = i.teamScore === null || i.opponentScore === null ? "" : ` ${i.teamScore}-${i.opponentScore}`;
  switch (o) {
    case "win": return `The team won${score} against ${i.opponent}${where}. What a day.`;
    case "draw": return `It finished${score} against ${i.opponent}${where}, with everyone giving their all.`;
    case "loss": return `Today's game against ${i.opponent}${where} ended${score}. The team kept going to the final whistle, and there is plenty to build on.`;
    default: return `The team played ${i.opponent}${where}.`;
  }
}

function childLine(i: StoryInput): string {
  if (!i.played) return `${i.firstName} was part of the squad and cheered the team on. Their time will come.`;
  if (i.rating === null) return `${i.firstName} took the pitch and played their part.`;
  if (i.rating >= 4) return `${i.firstName} had a really good game, and the coaches noticed.`;
  if (i.rating === 3) return `${i.firstName} put in a solid shift for the team.`;
  return `${i.firstName} worked hard out there, and every game like this helps them grow.`;
}

/**
 * The coach's note about this child, only if it reads kindly. A note that trips
 * the player-facing wording check is left out rather than quoted: the coach
 * wrote it for themselves, and the story should never repeat it to a child.
 */
export function usableNote(note: string | null): string | null {
  const trimmed = note?.trim();
  if (!trimmed || findFlaggedWording(trimmed).length > 0) return null;
  return trimmed;
}

export function buildMatchStory(input: StoryInput): string {
  const note = input.played ? usableNote(input.coachNote) : null;
  const parts = [resultLine(input), childLine(input)];
  if (note) parts.push(`Coach says: ${note}${/[.!?]$/.test(note) ? "" : "."}`);
  return parts.join(" ");
}

/** The first word of a full name, for the story. "A player" for a blank. */
export function firstNameOf(fullName: string | null | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || "Your child";
}

export interface FixtureFacts {
  opponent: string;
  isHome: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
}

export interface SquadFact {
  playerId: string;
  fullName: string;
  played: boolean;
  /** One entry per coach who rated this child. */
  ratings: { rating: number; note: string | null }[];
}

export interface StoryDraft { playerId: string; body: string }

/**
 * A draft story for every child on the squad sheet who has none yet. Children
 * who already have a message (a draft the coach has edited, or an approved
 * story) are left exactly as they are, so generating again never overwrites a
 * coach's words or touches what a family can already read.
 */
export function planStoryDrafts(fixture: FixtureFacts, squad: SquadFact[], haveMessage: ReadonlySet<string>): StoryDraft[] {
  return squad
    .filter((s) => !haveMessage.has(s.playerId))
    .map((s) => {
      const rated = s.ratings.map((r) => r.rating);
      const rating = rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : null;
      const coachNote = s.ratings.map((r) => r.note?.trim()).find((n) => n) ?? null;
      return {
        playerId: s.playerId,
        body: buildMatchStory({ firstName: firstNameOf(s.fullName), ...fixture, rating, coachNote, played: s.played }),
      };
    });
}
