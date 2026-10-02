import { formatDayMonth } from "@/lib/time";
import type { Meeting } from "@/lib/opponent-memory";
import type { FormationTally } from "@/lib/opponent-counter";

/**
 * The brief the scouting report is generated from, and fingerprinted on: only
 * what the academy has itself logged about this opponent. Deterministic -- no
 * clock, no unsorted collection -- so an unchanged history hits the cache.
 */
export function buildScoutingBrief(input: {
  teamName: string;
  opponent: string;
  meetings: readonly Meeting[];
  formations: readonly FormationTally[];
}): string {
  const lines: string[] = [`OPPONENT: ${input.opponent}`, `OUR TEAM: ${input.teamName}`, ""];

  if (input.meetings.length === 0) {
    lines.push("PREVIOUS MEETINGS: none logged.");
  } else {
    lines.push("PREVIOUS MEETINGS (most recent first):");
    for (const m of input.meetings) {
      const score = m.score ? `${m.score.team}-${m.score.opponent}` : "score not logged";
      lines.push(`- ${formatDayMonth(m.date)} ${m.isHome ? "home" : "away"}: ${score}${m.notes ? ` — notes: ${m.notes}` : ""}`);
    }
  }

  lines.push("");
  if (input.formations.length === 0) {
    lines.push("OPPONENT SHAPE FROM OUR SAVED PLAYS: none saved.");
  } else {
    lines.push(
      "OPPONENT SHAPE FROM OUR SAVED PLAYS: " +
        input.formations.map((f) => `${f.label} (${f.count} play${f.count === 1 ? "" : "s"})`).join(", ") +
        "."
    );
  }
  return lines.join("\n");
}

/** True when there is nothing logged to report on, so no model call is warranted. */
export function hasNoScoutingHistory(meetings: readonly Meeting[], formations: readonly FormationTally[]): boolean {
  return meetings.length === 0 && formations.length === 0;
}

/** Shown instead of a report when nothing is logged against the opponent. Lives here, not in the "use server" action file, which may export only async functions. */
export const NO_SCOUTING_HISTORY =
  "We have nothing logged against this opponent yet: no past result and no saved play. " +
  "Log the result after the match, or draw their shape on the tactical board, and the report will have something to work from.";
