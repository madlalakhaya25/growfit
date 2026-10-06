// Problems a coach can tap after a match instead of typing
// (docs/FEATURE_SPECS/match-to-training.md). The wording is the academy's own,
// approved by Buhle (strategy/buhle-approvals-recommended.md, section 4). Each is
// a judgement of the team, never of a child, and never names a player. Two age
// bands: U11 and below, and U13 and above; most wording is shared. Pure.

import type { MatchPhaseId } from "@/lib/match-phases";

export type ProblemBand = "all" | "older";

export interface MatchProblem {
  /** Stored as the objective's problem_key (60 characters or fewer), so repeats can be counted. */
  key: string;
  phase: MatchPhaseId;
  text: string;
  /** "older" means U13 and U15 only. */
  band: ProblemBand;
}

export const MATCH_PROBLEMS: readonly MatchProblem[] = [
  { key: "ip-lose-playing-out", phase: "in_possession", band: "all", text: "We lose the ball when we try to pass out from the back." },
  { key: "ip-long-balls", phase: "in_possession", band: "all", text: "We play too many long balls and lose the ball." },
  { key: "ip-no-width", phase: "in_possession", band: "all", text: "We do not spread out, so the ball carrier has no pass." },
  { key: "ip-no-shot", phase: "in_possession", band: "all", text: "We get into the box but do not take a shot." },
  { key: "ip-deep-block", phase: "in_possession", band: "older", text: "We cannot break a team that sits deep." },

  { key: "oop-bunching", phase: "out_of_possession", band: "all", text: "We bunch around the ball and leave space behind us." },
  { key: "oop-no-pressure", phase: "out_of_possession", band: "all", text: "Nobody takes the player with the ball, so they run at us freely." },
  { key: "oop-far-apart", phase: "out_of_possession", band: "all", text: "We are too far apart between the lines." },
  { key: "oop-press-timing", phase: "out_of_possession", band: "older", text: "We press at different times, so the press breaks." },
  { key: "oop-back-post", phase: "out_of_possession", band: "older", text: "We lose our runners at the back post." },

  { key: "at-kick-away", phase: "attacking_transition", band: "all", text: "When we win the ball we kick it away instead of keeping it." },
  { key: "at-no-support", phase: "attacking_transition", band: "all", text: "We win it but nobody runs forward to help." },
  { key: "at-use-space", phase: "attacking_transition", band: "older", text: "We do not use the space the other team leaves when they lose it." },

  { key: "dt-watch", phase: "defensive_transition", band: "all", text: "When we lose it we stop and watch instead of chasing." },
  { key: "dt-slow-recovery", phase: "defensive_transition", band: "all", text: "We are slow to get back into shape behind the ball." },
  { key: "dt-counter", phase: "defensive_transition", band: "older", text: "We let the other team counter-attack in the first five seconds." },

  { key: "sp-marking", phase: "set_pieces", band: "all", text: "We do not know who marks whom at their corners." },
  { key: "sp-waste-own", phase: "set_pieces", band: "all", text: "We waste our own corners and free kicks." },
  { key: "sp-throw-ins", phase: "set_pieces", band: "all", text: "Throw-ins: we lose the ball straight away." },
  { key: "sp-second-balls", phase: "set_pieces", band: "older", text: "We concede from second balls after a set piece." },
];

/** True for U13 and above. An age group with no number (or none given) counts as the younger band, so nothing too advanced is offered by mistake. */
export function isOlderBand(ageGroup: string | null | undefined): boolean {
  const n = Number.parseInt(/\d+/.exec(ageGroup ?? "")?.[0] ?? "", 10);
  return Number.isFinite(n) && n >= 13;
}

/** The problems to offer for a phase and age group, in the approved order. No phase means none: the coach picks the phase first. */
export function problemsFor(phase: MatchPhaseId | null, ageGroup: string | null | undefined): MatchProblem[] {
  if (!phase) return [];
  const older = isOlderBand(ageGroup);
  return MATCH_PROBLEMS.filter((p) => p.phase === phase && (p.band === "all" || older));
}

/**
 * The preset a typed problem is exactly equal to (ignoring case and spacing),
 * or null for the coach's own words. The key is only stored when the wording is
 * the approved wording, so an edited preset is counted as the coach's own.
 */
export function presetKeyFor(text: string): string | null {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const wanted = norm(text);
  return MATCH_PROBLEMS.find((p) => norm(p.text) === wanted)?.key ?? null;
}
