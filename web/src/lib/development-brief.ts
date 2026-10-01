import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_META, type MilestoneCategory } from "@/lib/development-categories";
import type { DevelopmentPlanStructured } from "@/lib/development-plan-schema";
import { ATTENDANCE_WINDOW_DAYS } from "@/lib/attendance";

/**
 * The player-scoped brief behind a development plan. Pure.
 *
 * buildSquadContext() can't be reused: it is team-scoped and gated on
 * getCoachedTeamIds. This is the same idea, for one player.
 *
 * ─── DETERMINISM IS LOAD-BEARING ─────────────────────────────────────────────
 * The brief is fingerprinted (lib/ai-artefacts.ts) and the fingerprint is the
 * cache key. Anything unstable -- an unsorted collection, a Map's iteration
 * order, a timestamp in the text -- changes the fingerprint with no change in
 * the data, the cache never hits, and the only symptom is a bill nobody
 * traces. So: every collection is sorted here, ties broken on a stable field,
 * and no "now" appears in the text.
 *
 * ─── TWO PARTS, AND ONLY ONE IS FINGERPRINTED ────────────────────────────────
 * `worldBrief` is the state of the world (attributes, form, milestones,
 * attendance). `fullBrief` is that plus the previous plan and what happened
 * since it. The fingerprint is over `worldBrief` ONLY.
 *
 * Fingerprinting the full brief would make caching impossible: generating plan
 * P1 stores a fingerprint of a brief with no previous plan; the very next call
 * builds a brief that now INCLUDES P1, so its fingerprint differs, so it
 * misses, regenerates P2, and the next call includes P2... it can never hit.
 * Keyed on the world alone: nothing changed -> hit; something changed ->
 * miss, and the new plan is generated with the old one as `previous`.
 */

export interface BriefInput {
  player: { fullName: string; position: string | null; age: number | null };
  /** Assessed attributes only -- never a defaulted 50. */
  attributes: { label: string; value: number }[];
  ratings: { rating: number; opponent: string | null; createdAt: string }[];
  /** Milestones completed in the current season. */
  completed: { title: string; category: MilestoneCategory }[];
  /** Milestones not yet completed this season, in the pathway's own order. */
  open: { id: string; title: string; category: MilestoneCategory; sortOrder: number }[];
  attendance: { attended: number; assessed: number; pct: number | null } | null;
  /** First day of the attendance window -- see bucketedAttendanceStart(). */
  attendanceSince: string;
}

export interface PreviousPlanContext {
  /** When the previous plan was written (ISO). */
  createdAt: string;
  structured: DevelopmentPlanStructured;
  /** Pre-computed so the model is told the facts, not asked to diff two blobs. */
  newCompletions: { title: string; category: MilestoneCategory }[];
  newRatings: { rating: number; opponent: string | null }[];
}

export const OPEN_MILESTONES_IN_BRIEF = 6;
export const RATINGS_IN_BRIEF = 8;

/**
 * First day (yyyy-mm-dd) of the attendance window, snapped to a month boundary.
 *
 * The window is "the last 90 days", which moves every day -- so a fingerprint
 * over it would change daily with no new data, and the 28-day cache window
 * would never be used. Snapping the start to the first of a month keeps it
 * fixed for the whole calendar month it is computed in, so the fingerprint only
 * moves when a register mark is actually added or a month turns over.
 *
 * It is the first of the month three months back -- except when that is under
 * 90 days before the first of THIS month (February to May is only 89), in which
 * case one month further. So the window is never narrower than the 90-day
 * policy window, and is 90-123 days wide.
 *
 * Snapped on `now`'s own month, NOT on the month containing `now - 90 days`:
 * that moves on a different calendar day each month rather than at month ends.
 */
export function bucketedAttendanceStart(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = Date.UTC(y, m, 1);
  let start = Date.UTC(y, m - 3, 1);
  if ((monthStart - start) / 86_400_000 < ATTENDANCE_WINDOW_DAYS) start = Date.UTC(y, m - 4, 1);
  return new Date(start).toISOString().slice(0, 10);
}

const categoryRank = (c: MilestoneCategory) => MILESTONE_CATEGORIES.indexOf(c);
const label = (c: MilestoneCategory) => MILESTONE_CATEGORY_META[c].label;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function ratingLine(r: { rating: number; opponent: string | null }): string {
  return `${r.rating}/5 vs ${r.opponent ?? "training"}`;
}

/** Whole years between a date of birth and `now`. Null for a missing or unparseable DOB. */
export function ageFromDob(dateOfBirth: string | null, now: Date): number | null {
  if (!dateOfBirth) return null;
  const dob = Date.parse(dateOfBirth);
  if (!Number.isFinite(dob)) return null;
  return Math.floor((now.getTime() - dob) / (365.25 * 24 * 3600 * 1000));
}

export function buildDevelopmentBrief(input: BriefInput, previous: PreviousPlanContext | null): {
  /** The fingerprinted part. */
  worldBrief: string;
  /** What is sent to the model. */
  fullBrief: string;
} {
  const { player } = input;

  const attributes = [...input.attributes].sort((a, b) => b.value - a.value || cmp(a.label, b.label));
  const ratings = [...input.ratings]
    .sort((a, b) => cmp(b.createdAt, a.createdAt) || cmp(a.opponent ?? "", b.opponent ?? "") || a.rating - b.rating)
    .slice(0, RATINGS_IN_BRIEF);
  const completed = [...input.completed].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category) || cmp(a.title, b.title)
  );
  const open = [...input.open]
    .sort(
      (a, b) =>
        categoryRank(a.category) - categoryRank(b.category) ||
        a.sortOrder - b.sortOrder ||
        cmp(a.title, b.title) ||
        cmp(a.id, b.id)
    )
    .slice(0, OPEN_MILESTONES_IN_BRIEF);

  const att = input.attendance;
  const attendanceLine =
    att && att.assessed > 0
      ? `${att.attended} of ${att.assessed} training sessions attended since ${input.attendanceSince} (${att.pct}%; the academy's threshold is 75%)`
      : `No training attendance recorded since ${input.attendanceSince}`;

  const world = [
    `Player: ${player.fullName}, Position: ${player.position ?? "Unknown"}, Age: ${player.age ?? "Unknown"}`,
    `Attributes (strongest to weakest): ${
      attributes.length ? attributes.map((a) => `${a.label} ${a.value}`).join(", ") : "none assessed yet"
    }`,
    `Recent form (newest first): ${ratings.length ? ratings.map(ratingLine).join("; ") : "no recent ratings"}`,
    `Milestones completed this season: ${
      completed.length ? completed.map((c) => `${label(c.category)}: ${c.title}`).join("; ") : "none yet"
    }`,
    "Open milestones (use the id in brackets as milestoneTemplateId when an action works toward one):",
    ...(open.length ? open.map((m) => `- [${m.id}] ${label(m.category)}: ${m.title}`) : ["- none open"]),
    `Training attendance: ${attendanceLine}`,
  ].join("\n");

  if (!previous) return { worldBrief: world, fullBrief: world };

  const prev = previous.structured;
  const newCompletions = [...previous.newCompletions].sort(
    (a, b) => categoryRank(a.category) - categoryRank(b.category) || cmp(a.title, b.title)
  );
  const newRatings = [...previous.newRatings].sort(
    (a, b) => cmp(a.opponent ?? "", b.opponent ?? "") || a.rating - b.rating
  );
  const previousSection = [
    "",
    `PREVIOUS PLAN (written ${previous.createdAt.slice(0, 10)}):`,
    `Summary: ${prev.playerSummary}`,
    ...prev.focusAreas.map((f) => `- Focus, ${label(f.category)}: ${f.area}`),
    ...prev.actions.map((a) => `- Action: ${a.what} (${a.timesPerWeek}x a week)`),
    "WHAT HAS HAPPENED SINCE THAT PLAN (facts, already worked out for you):",
    `- Milestones completed since: ${
      newCompletions.length ? newCompletions.map((c) => `${label(c.category)}: ${c.title}`).join("; ") : "none"
    }`,
    `- Ratings since: ${newRatings.length ? newRatings.map(ratingLine).join("; ") : "none"}`,
    `- Training attendance now: ${attendanceLine}`,
  ].join("\n");

  return { worldBrief: world, fullBrief: world + "\n" + previousSection };
}
