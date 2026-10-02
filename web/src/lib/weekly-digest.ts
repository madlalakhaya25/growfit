// The weekly family note (docs/AI_AND_UX_PLAN_2026.md step 4.8). One short,
// warm message per child, built from facts the app already holds: the week's
// training and match, the next fixture, and one action from the child's own
// coach-approved development plan. Deterministic on purpose, like the match
// story: a coach reads and can edit every word before a family sees it, and no
// player data goes to a model. First name only, nothing negative, no comparison
// with another child, and an absence is never mentioned.

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
}

function weekLine(f: DigestFacts): string | null {
  // Attendance is only ever good news here: a child who missed everything gets no line.
  if (f.sessionsAttended === 0 && f.matchesPlayed === 0) return null;
  const parts: string[] = [];
  if (f.sessionsAttended > 0) {
    parts.push(
      f.sessionsAttended === f.sessionsHeld
        ? `was at ${f.sessionsHeld === 1 ? "training" : `all ${f.sessionsHeld} training sessions`}`
        : `came to ${f.sessionsAttended} training ${f.sessionsAttended === 1 ? "session" : "sessions"}`,
    );
  }
  if (f.matchesPlayed > 0) parts.push(f.matchesPlayed === 1 ? "played in the match" : `played in ${f.matchesPlayed} matches`);
  return `This week ${f.firstName} ${parts.join(" and ")}. Well done.`;
}

function homeLine(f: DigestFacts): string | null {
  const c = f.homeChallenge;
  if (!c) return null;
  const times = c.timesPerWeek > 1 ? `, ${c.timesPerWeek} times this week` : "";
  const how = c.how.trim();
  return `One thing to try at home${times}: ${c.what.trim().replace(/[.!?]$/, "")}.${how ? ` ${how.replace(/([^.!?])$/, "$1.")}` : ""}`;
}

/** Null when there is nothing kind and true to say, so no empty note is ever written. */
export function buildDigest(f: DigestFacts): string | null {
  const week = weekLine(f);
  const home = homeLine(f);
  if (!week && !home) return null;
  const parts = [week, home];
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
