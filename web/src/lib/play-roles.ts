// "My job in this play": the pure half. Which players have a job, the
// deterministic brief the model is shown, and the validator for its answer.
// No "use server", no SDK, so Jest can test it.

import { createHash } from "node:crypto";
import { playerJobs } from "@/lib/board-coaching";
import { getPitch, type Shape, type Token } from "@/lib/board-model";
import { ltpdPhaseForAge } from "@/lib/ai-safeguards";

export const MAX_ROLE_PLAYERS = 18;
export const MAX_ROLE_CHARS = 420;

export interface PlayRoleEntry { playerId: string; text: string }
export interface PlayRolesData {
  roles: PlayRoleEntry[];
  /** Hash of the play as players see it: if the play changes after approval,
   * the stored text no longer matches and is not shown. */
  playHash: string;
}

export interface RosterPlayer {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  position: string | null;
}

export interface RolePlayer {
  playerId: string;
  name: string;
  age: number | null;
  position: string | null;
  jobs: string[];
}

interface PlayData {
  tokens?: Token[];
  shapes?: Shape[];
  pitchId?: string;
}

const wholeYears = (dob: string | null, now: Date): number | null => {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 31_557_600_000);
};

/** Plain code-unit order, spelled out so every sort that feeds a fingerprint is
 * locale-independent and keeps the order the default sort gave. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The players in this play who have something to do: a token tied to a real
 * player (placeholder tokens have nobody to write for) with at least one
 * drawn step. Sorted by player id so the brief is deterministic -- the
 * fingerprint must not change between two identical requests.
 */
export function collectRolePlayers(data: unknown, roster: RosterPlayer[], now: Date = new Date()): RolePlayer[] {
  const d = (data && typeof data === "object" ? data : {}) as PlayData;
  const tokens = Array.isArray(d.tokens) ? d.tokens : [];
  const shapes = Array.isArray(d.shapes) ? d.shapes : [];
  const byId = new Map(roster.map((p) => [p.id, p]));

  const out: RolePlayer[] = [];
  for (const job of playerJobs(tokens, shapes, getPitch(d.pitchId))) {
    if (job.side !== "player") continue;
    const token = tokens.find((t) => t.id === job.tokenId);
    const player = token?.playerId ? byId.get(token.playerId) : undefined;
    if (!player || out.some((o) => o.playerId === player.id)) continue;
    out.push({
      playerId: player.id,
      name: player.full_name.trim().split(/\s+/)[0] || "Player",
      age: wholeYears(player.date_of_birth, now),
      position: player.position,
      jobs: job.steps,
    });
  }
  out.sort((a, b) => byCodeUnit(a.playerId, b.playerId));
  return out.slice(0, MAX_ROLE_PLAYERS);
}

/** Deterministic: nothing in it depends on the clock beyond whole-year ages. */
export function buildPlayRolesBrief(play: { name: string; conceptLabels: string[] }, players: RolePlayer[]): string {
  const lines = [
    `PLAY: ${play.name}`,
    `CONCEPTS: ${play.conceptLabels.length ? [...play.conceptLabels].sort(byCodeUnit).join(", ") : "none tagged"}`,
    "PLAYERS (id | first name | age | position | what the coach drew for them):",
  ];
  for (const p of players) {
    const age = p.age === null ? "age unknown" : `age ${p.age} (${ltpdPhaseForAge(p.age)})`;
    lines.push(`${p.playerId} | ${p.name} | ${age} | ${p.position ?? "position unknown"} | ${p.jobs.join(" ")}`);
  }
  return lines.join("\n");
}

/** What a player could see of the play itself: the name, concepts and every
 * drawn job. Computed the same way on both sides so approval can be checked. */
export function playRolesHash(play: { name: string; conceptIds: string[] }, players: RolePlayer[]): string {
  const material = JSON.stringify({
    n: play.name,
    c: [...play.conceptIds].sort(byCodeUnit),
    p: players.map((p) => [p.playerId, p.jobs]),
  });
  return createHash("sha256").update(material, "utf8").digest("hex");
}

/** Keep only entries for players we asked about, with real text, once each. */
export function validatePlayRoles(raw: Record<string, unknown> | null, allowedIds: string[]): PlayRoleEntry[] {
  if (!raw || !Array.isArray(raw.roles)) return [];
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  const out: PlayRoleEntry[] = [];
  for (const item of raw.roles) {
    if (!item || typeof item !== "object") continue;
    const { playerId, text } = item as Record<string, unknown>;
    if (typeof playerId !== "string" || !allowed.has(playerId) || seen.has(playerId)) continue;
    const clean = typeof text === "string" ? text.replaceAll("*", "").trim().slice(0, MAX_ROLE_CHARS) : "";
    if (!clean) continue;
    seen.add(playerId);
    out.push({ playerId, text: clean });
  }
  return out;
}

export function roleForPlayer(data: Partial<PlayRolesData> | null | undefined, playerId: string): string | null {
  const hit = data?.roles?.find((r) => r.playerId === playerId);
  return hit?.text ?? null;
}
