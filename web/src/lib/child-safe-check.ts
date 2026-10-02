import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";

/**
 * A last look at the words a child and their family will read, before a coach
 * approves them. The rule (ai-safeguards.ts, PLAYER_FACING_RULE) is that
 * player-facing text is about where to grow, never what is wrong, and never a
 * comparison with another child.
 *
 * This is an aid to the coach, not a replacement for them: it catches the
 * obvious phrases and asks the coach to look. It will miss some wording and
 * will sometimes flag something harmless, so a coach who has read the flag can
 * still approve. Nothing is ever shared without a coach.
 */

/** Phrases that name a deficit, a concern or a comparison. Matched as whole words, case-insensitively. */
const FLAGGED: readonly string[] = [
  // deficits and judgements
  "weak", "weakness", "weaknesses", "poor", "poorly", "bad", "badly", "terrible", "worst", "lazy", "useless",
  "struggle", "struggles", "struggling", "failing", "failed", "fails", "fail", "mistakes", "problem", "problems",
  "deficit", "lacks", "lacking", "unable", "not good enough", "not able to",
  "falling behind", "worse", "underperform", "underperforming", "disappointing",
  // numbers a child could read as a verdict
  "low rating", "low score", "below average", "poor attendance", "missed sessions",
  // comparisons with other children
  "better than", "worse than", "other players", "other children", "teammates are", "rest of the team",
  "the best", "best in", "unlike", "compared to", "compared with",
];

/** Escape a phrase for use inside a RegExp. */
const esc = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const PATTERNS = FLAGGED.map((phrase) => ({
  phrase,
  re: new RegExp(String.raw`(?<![\p{L}\p{N}'])` + esc(phrase) + String.raw`(?![\p{L}\p{N}'])`, "iu"),
}));

/** The flagged phrases found in one piece of text, each listed once. */
export function findFlaggedWording(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.phrase);
}

/** Every piece of player-facing text in a plan, with where it came from. */
function playerFacingText(plan: PlayerSafeDevelopmentPlan): { where: string; text: string }[] {
  return [
    { where: "note to the player", text: plan.playerNote },
    ...plan.focusAreas.flatMap((f, i) => [
      { where: `focus ${i + 1} area`, text: f.area },
      { where: `focus ${i + 1} reason`, text: f.why },
    ]),
    ...plan.actions.flatMap((a, i) => [
      { where: `action ${i + 1}`, text: a.what },
      { where: `action ${i + 1} how`, text: a.how },
      { where: `action ${i + 1} measure`, text: a.measure },
    ]),
  ];
}

export interface WordingFlag {
  where: string;
  phrases: string[];
}

/** Where a plan's player-facing text uses wording the rule asks us to avoid. Empty when it looks fine. */
export function checkPlayerFacing(plan: PlayerSafeDevelopmentPlan): WordingFlag[] {
  return playerFacingText(plan)
    .map(({ where, text }) => ({ where, phrases: findFlaggedWording(text) }))
    .filter((f) => f.phrases.length > 0);
}

/** One line for a toast or a message. */
export function describeFlags(flags: WordingFlag[]): string {
  const quoted = (phrases: string[]) => phrases.map((p) => `"${p}"`).join(", ");
  return flags.map((f) => `${f.where}: ${quoted(f.phrases)}`).join("; ");
}
