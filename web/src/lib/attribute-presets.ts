// Quick attribute presets: tap a level, every slider fills in, then adjust.
//
// A level's base score is judged against the player's OWN age group, so an
// "Excellent" U11 and an "Excellent" U15 both start at 80 and the label says
// which age it is for ("80, Excellent for U11"). A role then nudges single
// attributes (a Box-to-box 8 gets more stamina and tackling, a Target striker
// more heading and strength). Every nudge is within +/-10 so the level still
// means what it says.
//
// APPROVED 2026-10-06 by Buhle (technical director). The wording and the role shapes below were written by Claude and were
// not live until he approved them. Presets stay hidden
// from coaches while PRESETS_APPROVED is false, the same gate the term review
// bands used (BAND_DESCRIPTIONS_APPROVED in lib/term-review.ts). Flip it only
// once he has signed off; edit the text first if he changes it, and set it
// back to false if the wording changes again.

import { ageBracket } from "@/lib/term-review";
import type { AttrKey } from "@/lib/attributes";
import type { RoleId } from "@/lib/player-roles";

export const PRESETS_APPROVED = true;

export const LEVELS = ["average", "good", "very_good", "excellent", "elite"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_SCORE: Record<Level, number> = {
  average: 50, good: 60, very_good: 70, excellent: 80, elite: 90,
};

export const LEVEL_LABEL: Record<Level, string> = {
  average: "Average", good: "Good", very_good: "Very good", excellent: "Excellent", elite: "Elite",
};

/** What each level means, for a player's own age group. */
export const LEVEL_MEANING: Record<Level, string> = {
  average: "A typical club player in the GDFL",
  good: "Starts most games for a strong club side",
  very_good: "Stands out in the league",
  excellent: "District or LFA select squad standard",
  elite: "Provincial squad or PSL academy standard",
};

/** The most a role may move one attribute from the level's base score. */
export const MAX_OFFSET = 10;

type Offsets = Partial<Record<AttrKey, number>>;

export const ROLE_OFFSETS: Record<RoleId, Offsets> = {
  shot_stopper: { shot_stopping: 8, reflexes: 8, handling: 4, distribution: -6 },
  sweeper_keeper: { distribution: 8, game_reading: 8, pace: 5, shot_stopping: -4 },
  stopper: { tackling: 8, heading: 8, strength: 6, marking: 6, passing: -6, dribbling: -8 },
  ball_playing: { passing: 8, ball_control: 6, composure: 6, decision_making: 4, heading: -4, tackling: -4 },
  cover: { positioning: 8, pace: 6, game_reading: 6, marking: 4, heading: -4 },
  overlapping: { pace: 8, stamina: 8, crossing: 8, off_ball_movement: 4, tackling: -4, heading: -6 },
  inverted: { passing: 8, decision_making: 6, ball_control: 6, positioning: 4, crossing: -8, pace: -4 },
  defensive: { tackling: 8, marking: 8, positioning: 6, crossing: -6, dribbling: -6 },
  anchor: { positioning: 8, tackling: 6, game_reading: 6, marking: 6, dribbling: -8, shooting: -6 },
  deep_playmaker: { passing: 10, game_reading: 8, composure: 6, tackling: -4, pace: -4 },
  ball_winner: { tackling: 10, pressing: 8, strength: 6, work_rate: 6, passing: -6, dribbling: -6 },
  box_to_box: { stamina: 10, tackling: 6, work_rate: 6, off_ball_movement: 4, heading: -4, crossing: -4 },
  half_space_runner: { off_ball_movement: 10, pace: 6, stamina: 4, first_touch: 4, tackling: -6, heading: -6 },
  playmaker: { passing: 10, decision_making: 8, first_touch: 6, game_reading: 6, strength: -6, tackling: -6 },
  classic_10: { passing: 8, dribbling: 8, game_reading: 6, first_touch: 6, stamina: -6, tackling: -8 },
  shadow_striker: { off_ball_movement: 10, finishing: 6, pace: 4, passing: -4, tackling: -8 },
  touchline_winger: { pace: 10, crossing: 8, dribbling: 6, stamina: 4, heading: -8, tackling: -6 },
  inside_forward: { finishing: 8, dribbling: 8, off_ball_movement: 6, shooting: 6, crossing: -6, tackling: -6 },
  wide_playmaker: { passing: 8, crossing: 6, decision_making: 6, first_touch: 4, strength: -4, finishing: -4 },
  target: { heading: 10, strength: 10, jumping: 8, finishing: 4, pace: -8, agility: -6 },
  poacher: { finishing: 10, off_ball_movement: 8, positioning: 6, composure: 4, work_rate: -6, passing: -6 },
  false_9: { passing: 8, first_touch: 8, dribbling: 6, game_reading: 6, heading: -8, strength: -6 },
  pressing_forward: { pressing: 10, work_rate: 8, stamina: 8, pace: 4, finishing: -4, composure: -4 },
};

const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
const within = (n: number) => Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, n));

/** The score for one attribute at a level, for a role (or none). */
export function presetScore(level: Level, key: AttrKey, role: RoleId | null | undefined): number {
  const offset = role ? (ROLE_OFFSETS[role]?.[key] ?? 0) : 0;
  return clamp(LEVEL_SCORE[level] + within(offset));
}

/** A preset for exactly the attributes a form shows, no more. */
export function presetFor(level: Level, keys: readonly AttrKey[], role: RoleId | null | undefined): Partial<Record<AttrKey, number>> {
  const out: Partial<Record<AttrKey, number>> = {};
  for (const key of keys) out[key] = presetScore(level, key, role);
  return out;
}

/** The nearest level to a score, or null when it is further than 5 from every
 * level (below 45, above 95), so a rough number is not given a label. */
export function levelOf(score: number): Level | null {
  let best: Level | null = null;
  let bestD = Infinity;
  for (const level of LEVELS) {
    const d = Math.abs(score - LEVEL_SCORE[level]);
    if (d < bestD) { best = level; bestD = d; }
  }
  return bestD <= 5 ? best : null;
}

/** "80, Excellent for U11": the score, its level, and the age it is judged
 * against, so a parent does not compare an U11 with an U15. */
export function levelLabel(score: number, ageGroup: string | null | undefined): string {
  const level = levelOf(score);
  const age = ageBracket(ageGroup);
  return level ? `${Math.round(score)}, ${LEVEL_LABEL[level]} for ${age}` : `${Math.round(score)}`;
}

/** Growth spurts move these a lot between 11 and 15. */
export const GROWTH_SENSITIVE: ReadonlySet<AttrKey> = new Set<AttrKey>(["pace", "strength", "jumping", "stamina", "agility"]);
export const PHYSICAL_NOTE = "Pace, strength and the other physical scores move a lot between 11 and 15 as players grow, so treat them as a snapshot.";
