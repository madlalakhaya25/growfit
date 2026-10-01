import { calculateAge } from "@/lib/player";
import { POSITIONS } from "@/lib/types";
import { ATTENDANCE_WINDOW_DAYS, WELFARE_ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import { fingerprintBrief } from "@/lib/ai-artefacts";

/**
 * The STABLE half of the squad brief: who is on the team, their position and
 * age band, and the academy's policy numbers. It changes only when the squad
 * does (a signing, a release, a position change, a birthday), which is what
 * makes it worth caching. Everything that moves week to week — form,
 * attendance, availability, injuries, results — lives in the volatile half and
 * is rebuilt per request in `buildSquadContext`.
 *
 * Deterministic by construction: players are sorted (the database returns
 * `team_members` in no promised order, and an unstable order would change the
 * hash on every call, so the cache would never hit and nothing would show it).
 */

const posLabel = (v: string | null) => POSITIONS.find((p) => p.value === v)?.label ?? "unknown position";

export interface StableBriefPlayer {
  id: string;
  full_name: string;
  position: string | null;
  date_of_birth: string | null;
}

export function buildStableBrief(input: {
  teamName: string;
  ageGroup: string | null;
  players: readonly StableBriefPlayer[];
}): string {
  const sorted = [...input.players].sort(
    (a, b) => a.full_name.localeCompare(b.full_name, "en") || a.id.localeCompare(b.id)
  );
  const lines: string[] = [
    `TEAM: ${input.teamName}${input.ageGroup ? ` (${input.ageGroup})` : ""} — ${sorted.length} registered players.`,
    "",
    "ROSTER:",
  ];
  for (const p of sorted) {
    const age = calculateAge(p.date_of_birth);
    lines.push(`- ${p.full_name} — ${posLabel(p.position)}${age ? `, age ${age}` : ""}`);
  }
  lines.push(
    "",
    `POLICY: training attendance below ${Math.round(WELFARE_ATTENDANCE_THRESHOLD * 100)}% over the last ${ATTENDANCE_WINDOW_DAYS} days triggers a welfare check-in, not a punishment.`
  );
  return lines.join("\n");
}

/**
 * Cache key: academy + team + a hash of the stable brief's own text.
 *
 * The plan suggested `max(updated_at)` across `players` and `team_members` as
 * the roster version, but neither table has an `updated_at`. Hashing the text
 * is also strictly more correct: it changes exactly when what the model would
 * be told changes, and not when an unrelated column does.
 */
export function stableBriefKey(academyId: string, teamId: string, stableBrief: string): string {
  return `${academyId}:${teamId}:${fingerprintBrief(stableBrief).slice(0, 24)}`;
}
