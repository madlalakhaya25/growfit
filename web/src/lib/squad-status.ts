import { countsAsAttended, countsTowardTotal, type AttendanceStatus } from "@/lib/attendance";
import { POSITIONS } from "@/lib/types";
import type { ReadinessLevel } from "@/lib/readiness";

/**
 * The one line under each name on the squad list (2026-10-25 redesign). It
 * used to be a row of up to nine badges; now it is the single most useful
 * thing to know about the child today, in plain words.
 *
 * Clay means "needs a word" and always beats good news; sun is good news;
 * neutral is a plain fact so every row still says something.
 */
export type SquadStatusTone = "clay" | "sun" | "neutral";

export interface SquadStatusInput {
  availability: { status: string; note: string | null } | null;
  attendance: number | null;
  belowThreshold: boolean;
  readinessLevel: ReadinessLevel | null;
  docsOutstanding: number;
  streak: number;
  seasonMinutes: number | null;
  assessed: boolean;
  age: number | null;
}

/** A run this long earns a mention. Three in a row is just a normal fortnight. */
export const STREAK_WORTH_SAYING = 4;

export function squadStatus(p: SquadStatusInput): { text: string; tone: SquadStatusTone } {
  const withNote = (label: string, note: string | null) => (note?.trim() ? `${label} · ${note.trim()}` : label);
  if (p.availability?.status === "injured") return { text: withNote("Injured", p.availability.note), tone: "clay" };
  if (p.availability) return { text: withNote("Unavailable", p.availability.note), tone: "clay" };
  if (p.belowThreshold && p.attendance !== null) return { text: `${p.attendance}% this term · check in`, tone: "clay" };
  if (p.readinessLevel === "check-in") return { text: "Check in this week", tone: "clay" };
  if (p.readinessLevel === "watch") return { text: "Keep an eye", tone: "clay" };
  if (p.docsOutstanding > 0) {
    return { text: `${p.docsOutstanding} form${p.docsOutstanding === 1 ? "" : "s"} due`, tone: "clay" };
  }
  if (p.streak >= STREAK_WORTH_SAYING) return { text: `${p.streak} sessions in a row`, tone: "sun" };
  if (p.seasonMinutes) return { text: `${p.seasonMinutes}′ this season`, tone: "neutral" };
  if (!p.assessed) return { text: "Not assessed yet", tone: "neutral" };
  if (p.attendance !== null) return { text: `${p.attendance}% training`, tone: "neutral" };
  return { text: p.age ? `Age ${p.age}` : "New to the squad", tone: "neutral" };
}

/**
 * Sessions in a row a player has come to, counting back from the latest
 * register. Excused doesn't break a run or add to it; absent, or missing
 * from a register that was taken, ends it. Sessions with no register at all
 * are skipped, since that's the coach's gap, not the child's.
 *
 * `sessions` is newest first; `marks` maps session id to that session's
 * marks by player id.
 */
export function attendanceStreak(
  playerId: string,
  sessions: readonly string[],
  marks: ReadonlyMap<string, ReadonlyMap<string, AttendanceStatus>>,
): number {
  let run = 0;
  for (const id of sessions) {
    const register = marks.get(id);
    if (!register || register.size === 0) continue;
    const mark = register.get(playerId);
    if (!mark) break;
    if (!countsTowardTotal(mark)) continue;
    if (!countsAsAttended(mark)) break;
    run++;
  }
  return run;
}

/** "CB" for a centre back, "Defender" for an old-style position, "" for none. */
export function positionShort(position: string | null): string {
  if (!position) return "";
  const label = POSITIONS.find((x) => x.value === position)?.label ?? "";
  return label.match(/\(([A-Z]+)\)/)?.[1] ?? label;
}
