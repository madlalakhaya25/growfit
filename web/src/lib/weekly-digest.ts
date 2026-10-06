// The weekly family note (docs/AI_AND_UX_PLAN_2026.md step 4.8). One short,
// warm message per child, built from facts the app already holds: the week's
// training and match, the next fixture, and one action from the child's own
// coach-approved development plan. Deterministic on purpose, like the match
// story: a coach reads and can edit every word before a family sees it, and no
// player data goes to a model. First name only, nothing negative, no comparison
// with another child, and an absence is never mentioned.

import type { MatchPhaseId } from "@/lib/match-phases";
import { firstNameOf } from "@/lib/match-story";

const DAY_MS = 86_400_000;

/** The Monday on or before this date, as YYYY-MM-DD, from a YYYY-MM-DD in the academy's timezone. */
export function weekKeyFor(todayYmd: string): string {
  const d = new Date(`${todayYmd}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

export interface DigestFacts {
  firstName: string;
  /** Sessions the team held this week, and how many this child came to (present or late). */
  sessionsHeld: number;
  sessionsAttended: number;
  /** Matches this child played in this week. */
  matchesPlayed: number;
  /** The team's next fixture, already formatted for a parent ("Sunday 12 October"), or null. */
  nextFixture: { opponent: string; when: string } | null;
  /** One action from the child's approved plan, or null. */
  homeChallenge: { what: string; how: string; timesPerWeek: number } | null;
  /** What the whole team worked on this week, in family words (see `teamFocusText`), or null. Never about one child. */
  teamFocus?: string | null;
}

/** Each phase of play in words a family understands. Fixed text, so no child's name can reach a family through it. */
const FAMILY_PHASE_WORDS: Record<MatchPhaseId, string> = {
  in_possession: "keeping and using the ball",
  out_of_possession: "working together when the other team has the ball",
  attacking_transition: "what we do the moment we win the ball",
  defensive_transition: "what we do the moment we lose the ball",
  set_pieces: "corners, free kicks and throw-ins",
};

/**
 * The team-level line for the weekly note, from the phases of play the team's
 * open objectives are about. Built only from the fixed phrases above, never from
 * the coach's own words, and only for objectives with a session planned. Null
 * when there is nothing to say.
 */
export function teamFocusText(phases: ReadonlyArray<MatchPhaseId | null>): string | null {
  const words = [...new Set(phases.flatMap((p) => (p ? [FAMILY_PHASE_WORDS[p]] : [])))];
  if (words.length === 0) return null;
  return `This week the team worked on ${words.join(" and ")}.`;
}

function trainingPhrase(held: number, attended: number): string {
  if (attended === held) return held === 1 ? "was at training" : `was at all ${held} training sessions`;
  const noun = attended === 1 ? "session" : "sessions";
  return `came to ${attended} training ${noun}`;
}

function weekLine(f: DigestFacts): string | null {
  // Attendance is only ever good news here: a child who missed everything gets no line.
  if (f.sessionsAttended === 0 && f.matchesPlayed === 0) return null;
  const parts: string[] = [];
  if (f.sessionsAttended > 0) parts.push(trainingPhrase(f.sessionsHeld, f.sessionsAttended));
  if (f.matchesPlayed === 1) parts.push("played in the match");
  else if (f.matchesPlayed > 1) parts.push(`played in ${f.matchesPlayed} matches`);
  return `This week ${f.firstName} ${parts.join(" and ")}. Well done.`;
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function homeLine(f: DigestFacts): string | null {
  const c = f.homeChallenge;
  if (!c) return null;
  const times = c.timesPerWeek > 1 ? `, ${c.timesPerWeek} times this week` : "";
  const what = sentence(c.what);
  const how = c.how.trim() ? ` ${sentence(c.how)}` : "";
  return `One thing to try at home${times}: ${what}${how}`;
}

/** Null when there is nothing kind and true to say, so no empty note is ever written. */
export function buildDigest(f: DigestFacts): string | null {
  const week = weekLine(f);
  const home = homeLine(f);
  if (!week && !home) return null;
  const parts = [week, f.teamFocus ?? null, home];
  if (f.nextFixture) parts.push(`Next up: ${f.nextFixture.opponent} on ${f.nextFixture.when}.`);
  parts.push("Thank you for all your support.");
  return parts.filter((p): p is string => p !== null).join(" ");
}

export interface DigestPlayerFacts extends Omit<DigestFacts, "firstName"> {
  playerId: string;
  fullName: string;
}

export interface DigestDraft { playerId: string; body: string }

/**
 * A draft for every child with something to say and no note yet this week.
 * Children who already have one (a draft the coach edited, or a shared note)
 * are left exactly as they are, so writing again never overwrites a coach.
 */
export function planDigestDrafts(players: DigestPlayerFacts[], haveMessage: ReadonlySet<string>): DigestDraft[] {
  return players
    .filter((p) => !haveMessage.has(p.playerId))
    .flatMap((p) => {
      const body = buildDigest({ ...p, firstName: firstNameOf(p.fullName) });
      return body ? [{ playerId: p.playerId, body }] : [];
    });
}
