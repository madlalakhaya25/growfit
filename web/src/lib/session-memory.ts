// What the team has actually been doing in training, as text the next session
// plan can build on. Pure: the data comes in, a deterministic brief goes out.
//
// Same memory pattern as the development plan: the model is shown what
// happened since, pre-computed, instead of each plan starting from nothing.

import { formatDayMonth } from "@/lib/time";

export const MEMORY_SESSIONS = 3;
const MAX_DRILLS_PER_SESSION = 6;

export interface PastSession {
  title: string;
  sessionType: string;
  /** ISO timestamp. */
  date: string;
  notes: string | null;
  drills: { title: string; description: string | null }[];
  /** Players marked present or late. */
  attended: number;
  /** Players marked at all, excused left out (the attendance policy's total). */
  assessed: number;
}

/** The "LTPD Focus: ..." line packDrillDescription writes, if the drill came
 * from the generator; hand-made drills have none. */
function focusOf(description: string | null): string | null {
  const m = description?.match(/^LTPD Focus:\s*(.+)$/m);
  return m ? m[1].trim().slice(0, 100) : null;
}

/**
 * Most recent first. Sessions nobody planned drills for and nobody marked are
 * still listed (the team did train), but only what is known is stated: no
 * invented turnout, no invented drills.
 */
export function buildSessionMemory(sessions: PastSession[]): string | null {
  const recent = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MEMORY_SESSIONS);
  if (recent.length === 0) return null;

  const lines: string[] = [];
  recent.forEach((s, i) => {
    lines.push(`${i === 0 ? "LAST SESSION" : `BEFORE THAT (${i + 1} sessions ago)`}: "${s.title}" on ${formatDayMonth(s.date)} (${s.sessionType})`);
    lines.push(
      s.assessed > 0
        ? `  Turnout: ${s.attended} of ${s.assessed} marked players came.`
        : "  Turnout: the register was not marked."
    );
    if (s.drills.length === 0) {
      lines.push("  Drills: none were recorded for this session.");
    } else {
      lines.push("  What was coached:");
      s.drills.slice(0, MAX_DRILLS_PER_SESSION).forEach((d) => {
        const focus = focusOf(d.description);
        lines.push(`  - ${d.title}${focus ? ` (${focus})` : ""}`);
      });
    }
    if (s.notes?.trim()) lines.push(`  Coach's note: ${s.notes.trim().slice(0, 200)}`);
  });
  return lines.join("\n");
}

/** The instructions that make the model use it. */
export const SESSION_MEMORY_RULES =
  "Build on what the team has been doing: progress from the most recent session's work rather than starting over, " +
  "do not repeat a drill by name, and keep the thread of any theme running through them. " +
  "If the last turnout was low or the register unmarked, do not assume who is there beyond the player count in the constraints. " +
  "Only the sessions listed happened; never invent others.";
