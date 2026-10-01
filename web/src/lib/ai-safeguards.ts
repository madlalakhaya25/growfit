/**
 * The system-prompt text and developmental-phase mapping every AI feature
 * shares, in one place.
 *
 * Before this existed the "UEFA Pro Licence ..." persona was copy-pasted into
 * four calls in tactics.ts and one in session-generator.ts (each slightly
 * different), COACH_SYSTEM lived inside coach-assistant.ts, and the LTPD
 * age-to-phase mapping was written out three times -- tactics.ts,
 * session-generator.ts (under the typo `getLTDPPhase`) and inline in
 * ai-insights.ts -- so a change to the safeguarding wording had to be found
 * and made in five places, by hand, and the places had already drifted.
 */

// ─── Safeguarding rules ──────────────────────────────────────────────────────

/**
 * Rule 1: nothing reaches a child or parent unreviewed. Enforced in code, not
 * just in the prompt -- see approveDevelopmentPlan() and the two-row
 * 'development_plan' / 'development_plan_shared' split (migration 045) -- but
 * stated to the model too so it writes with the right reader in mind.
 */
export const APPROVAL_RULE =
  "Nothing you write is shown to a player or parent until a coach has read and approved it.";

/**
 * Rule 2: player-facing text is about where to grow, never what is wrong. The
 * deficit, the concern and the verdict on a previous plan belong only in the
 * fields written for the coach.
 */
export const PLAYER_FACING_RULE =
  "Any text a player or parent will read must be framed as something to work toward, in warm plain language a child can follow. " +
  "It must never name a weakness, a deficit, a low rating, poor attendance or a comparison with another child. " +
  "Anything critical, any concern and any judgement of a previous plan belongs only in the fields written for the coach.";

/**
 * The assistant-coach persona behind every squad-aware feature
 * (coach-assistant.ts). Moved here verbatim, plus the two rules above.
 */
export const COACH_SYSTEM =
  "You are the assistant coach at Growfit Sports Academy, a SAFA-registered grassroots youth academy in Greater Durban, South Africa. " +
  "You are grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model, SAFA's National Development Programme curriculum, and CAF youth development principles. " +
  "You are given a brief with the squad's real data. Always use the real player names and real numbers from that brief — never invent a player, a rating, a result or a statistic that is not in it. If the brief does not contain what is needed, say so plainly and say what the coach should record. " +
  "The academy's attendance policy is 75% per term, and dropping below it triggers a welfare check-in, not a punishment. " +
  "These are children: player welfare and long-term development always outrank winning a single match. Never suggest anti-football, time-wasting, or playing an injured or unwell child. " +
  "Never repeat a child's medical details, ID number or contact information. " +
  `${APPROVAL_RULE} ${PLAYER_FACING_RULE} ` +
  "Answer like an experienced coach talking to a colleague: direct, practical, and short. Plain text only — no asterisks, no Markdown formatting.";

/**
 * The "UEFA Pro Licence" specialist persona used by the tactical, positional
 * and session-planning features, with the one clause that actually differs
 * between them (what the guidance is *for*) as a parameter.
 *
 * `plainText` is "only" for prose answers and "in every field" for JSON-mode
 * answers, where the plain-text rule applies inside each string value.
 */
export function specialistSystem(opts: {
  /** What the guidance is about, e.g. "positions", "training sessions". */
  focus: string;
  /** Extra role, e.g. "opposition analyst". */
  alsoA?: string;
  plainText?: "only" | "in every field";
}): string {
  const role = opts.alsoA ? ` and ${opts.alsoA}` : "";
  const plain =
    opts.plainText === "in every field"
      ? "Plain text inside every field — no asterisks, no Markdown formatting."
      : "Plain text only — no asterisks, no Markdown formatting.";
  return (
    `You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist${role}. ` +
    `Everything you write about ${opts.focus} is grounded in FIFA's Long-Term Player Development (LTPD) framework, ` +
    "the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), " +
    "SAFA's National Development Programme curriculum, and CAF youth development principles. " +
    "You understand the South African grassroots football landscape, keep everything age-appropriate and player-centred, " +
    "and know that player development always outranks winning a single match. " +
    plain
  );
}

// ─── LTPD phase ──────────────────────────────────────────────────────────────

const PHASES: { maxAge: number; name: string; focus: string }[] = [
  { maxAge: 9, name: "FUNdamentals (U6-U9)", focus: "ABCs of movement, fun-first, no tactical demands" },
  { maxAge: 12, name: "Learning to Train (U10-U12)", focus: "first technical window, high ball contacts, 1v1 mastery" },
  { maxAge: 15, name: "Training to Train (U13-U15)", focus: "positional play, decision-making, tactical introduction" },
  { maxAge: 18, name: "Training to Compete (U16-U18)", focus: "game model implementation, high-intensity transitions, set pieces" },
  { maxAge: Infinity, name: "Training to Win (U19+)", focus: "elite competition preparation, full tactical complexity" },
];
const DEFAULT_PHASE = PHASES[2]; // U13-U15, the academy's middle band

/** Short name for a numeric age, e.g. "Training to Train (U13-U15)". Unknown age -> the default band. */
export function ltpdPhaseForAge(age: number | null | undefined): string {
  return phaseForAge(age).name;
}

function phaseForAge(age: number | null | undefined) {
  if (age === null || age === undefined || !Number.isFinite(age) || age <= 0) return DEFAULT_PHASE;
  return PHASES.find((p) => age <= p.maxAge) ?? DEFAULT_PHASE;
}

/**
 * Phase name plus what that phase is about, for an age-group label such as
 * "U13". No digits in the label -> the default band.
 */
export function getLTPDPhase(ageGroup: string): string {
  const match = ageGroup.match(/\d+/);
  const p = match ? phaseForAge(parseInt(match[0], 10)) : DEFAULT_PHASE;
  return `${p.name} — ${p.focus}`;
}
