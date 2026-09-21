import { calculateAge } from "@/lib/player";

/**
 * Age-band and duplicate-registration checks (docs/BACKLOG.md 2.4).
 *
 * Fielding an overage player is a forfeit and a reportable matter under the
 * agreement parents sign; a duplicate registration (the same child, or the
 * same identity document, registered twice) is exactly the kind of gap that
 * is expensive to discover on a Sunday morning rather than in the office
 * during the week. Both are advisory flags for a human to check, not a hard
 * block — like the welfare threshold, the point is surfacing the question,
 * not deciding it automatically.
 */

/**
 * The age band a "Uxx" team name implies, as [min, max] years old inclusive.
 *
 * SAFA/LFA age-group cutoffs vary by association and season, and getting a
 * specific cutoff date wrong would produce confident-looking false
 * positives — so this deliberately uses a wider, unambiguous band (the
 * named age itself, plus the two years below it) rather than a precise
 * cutoff rule. It catches real mistakes (a 17-year-old registered in "U11",
 * an adult in a "U13" squad) without flagging the ordinary case of a squad
 * that spans most of a season on either side of a birthday. Age-group
 * labels with no leading "U" and digits (e.g. "Senior") have no fixed band
 * and are never flagged.
 */
export function ageGroupBand(ageGroup: string | null | undefined): [number, number] | null {
  const match = ageGroup?.match(/^U(\d+)$/i);
  if (!match) return null;
  const max = parseInt(match[1], 10);
  return [Math.max(0, max - 2), max];
}

export interface AgeFlag {
  playerId: string;
  playerName: string;
  age: number;
  ageGroup: string;
  band: [number, number];
}

/** Players whose current age falls outside their team's age band. */
export function flagAgeEligibility(
  players: { id: string; full_name: string; date_of_birth: string | null; age_group: string | null }[]
): AgeFlag[] {
  const flags: AgeFlag[] = [];
  for (const p of players) {
    const band = ageGroupBand(p.age_group);
    if (!band) continue;
    const age = calculateAge(p.date_of_birth);
    if (age === null) continue;
    if (age < band[0] || age > band[1]) {
      flags.push({ playerId: p.id, playerName: p.full_name, age, ageGroup: p.age_group!, band });
    }
  }
  return flags;
}

export interface DuplicateGroup {
  reason: "ID number" | "SAFA number" | "name and date of birth";
  key: string;
  players: { id: string; full_name: string }[];
}

/**
 * Groups of two or more players sharing an identifying field. Blank/null
 * values are never compared against each other — every player missing an ID
 * number would otherwise "match" every other player missing one.
 */
export function findDuplicates(
  players: {
    id: string;
    full_name: string;
    date_of_birth: string | null;
    id_number?: string | null;
    mysafa_number?: string | null;
  }[]
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  const byKey = (
    reason: DuplicateGroup["reason"],
    keyOf: (p: (typeof players)[number]) => string | null
  ) => {
    const map = new Map<string, { id: string; full_name: string }[]>();
    for (const p of players) {
      const key = keyOf(p);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push({ id: p.id, full_name: p.full_name });
      map.set(key, list);
    }
    for (const [key, group] of map) {
      if (group.length > 1) groups.push({ reason, key, players: group });
    }
  };

  byKey("ID number", (p) => p.id_number?.trim().toUpperCase() || null);
  byKey("SAFA number", (p) => p.mysafa_number?.trim().toUpperCase() || null);
  byKey("name and date of birth", (p) =>
    p.date_of_birth ? `${p.full_name.trim().toLowerCase()}|${p.date_of_birth}` : null
  );

  return groups;
}
