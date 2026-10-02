// A term laid out across the academy's fixed week (docs/AI_AND_UX_PLAN_2026.md
// step 4.4): training on Wednesday and Friday, the match on Sunday. Instead of
// planning one session at a time, this spreads load and the four corners
// (technical, tactical, physical, psychological) over the whole term, eases off
// in the first week and every fourth week, and ties the Friday session to the
// weekend's match when there is one. Deterministic and reviewed by the coach: no
// model, and nothing here reaches a child. Each planned session can be added to
// the coach's training list, where it is edited like any other.

import { ageBracket, type AgeBracket } from "@/lib/term-review";
import { weekKeyFor } from "@/lib/weekly-digest";

const DAY_MS = 86_400_000;

export type SessionType = "general" | "technical" | "tactical" | "fitness" | "match_prep" | "recovery";
export type Corner = "technical" | "tactical" | "physical" | "psychological";
export type Load = "settle" | "build" | "lighter" | "finish";
export type Intensity = "Easy" | "Moderate" | "Hard";

export const CORNER_LABELS: Record<Corner, string> = {
  technical: "Technical", tactical: "Tactical", physical: "Physical", psychological: "Psychological",
};
const CORNERS: Corner[] = ["technical", "tactical", "physical", "psychological"];

export const LOAD_LABELS: Record<Load, string> = {
  settle: "Settle in", build: "Build", lighter: "Lighter week", finish: "Finish strong",
};
const LOAD_NOTES: Record<Load, string> = {
  settle: "A gentle start: children are back from the break, so keep it light and fun.",
  build: "A normal working week.",
  lighter: "Ease off the volume so legs are fresh. Easier sessions here make the harder weeks count.",
  finish: "Keep the energy up for the last week of term without piling on more work.",
};

/** What each corner looks like in a session, by age bracket. Several themes per corner so a term does not repeat. */
const THEMES: Record<Corner, Record<AgeBracket, string[]>> = {
  technical: {
    U11: ["Dribbling games with lots of touches", "Passing and receiving in small groups", "Turning and shooting games"],
    U13: ["First touch under light pressure", "Passing patterns and combinations", "Dribbling to beat a player, then finish"],
    U15: ["Receiving on the half-turn", "Combination play in tight spaces", "Finishing from different angles"],
  },
  tactical: {
    U11: ["Small-sided games: spread out when we have the ball", "Small-sided games: stay close to help when we lose it", "Where to stand to receive a pass"],
    U13: ["Keeping shape in attack and defence", "Pressing together as a unit", "Playing out from the back"],
    U15: ["Pressing triggers and covering space", "Building through the thirds", "Transitions: winning it and losing it"],
  },
  physical: {
    U11: ["Movement and coordination games", "Running, jumping and balance circuits as games", "Tag and chasing games with the ball"],
    U13: ["Agility and change of direction", "Speed and quick feet with the ball", "Strength through bodyweight play"],
    U15: ["Speed and acceleration", "Agility and repeated sprint ability", "Strength and injury-prevention work"],
  },
  psychological: {
    U11: ["Team games that need talking to each other", "Fun competitions where everyone contributes", "Trying again after a mistake"],
    U13: ["Communication and encouraging each other", "Handling pressure in small competitions", "Taking responsibility in games"],
    U15: ["Leadership and captaincy moments", "Composure when the game is tight", "Setting goals for the next match"],
  },
};

const CORNER_TYPE: Record<Corner, SessionType> = {
  technical: "technical", tactical: "tactical", physical: "fitness", psychological: "general",
};

export interface FixtureFact { date: string; opponent: string }

export interface PlannedSession {
  /** YYYY-MM-DD */
  date: string;
  weekday: "Wednesday" | "Friday";
  title: string;
  type: SessionType;
  intensity: Intensity;
  notes: string;
}

export interface PlanWeek {
  index: number;
  /** The Monday, YYYY-MM-DD. */
  weekKey: string;
  load: Load;
  corner: Corner;
  fixtures: FixtureFact[];
  note: string;
  sessions: PlannedSession[];
}

const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);

/** The load for a week: gentle first week, lighter every fourth week, steady finish, else build. */
export function loadFor(index: number, total: number): Load {
  if (index === 0) return "settle";
  if (index === total - 1 && total > 2) return "finish";
  if (index % 4 === 3) return "lighter";
  return "build";
}

function intensities(load: Load, hasMatch: boolean): [Intensity, Intensity] {
  switch (load) {
    case "settle": return ["Easy", "Moderate"];
    case "lighter": return ["Easy", "Easy"];
    case "finish": return ["Moderate", "Easy"];
    default: return hasMatch ? ["Hard", "Moderate"] : ["Hard", "Hard"];
  }
}

const dayMonth = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", timeZone: "UTC" });

export function buildTermPlan(input: {
  term: { starts_on: string; ends_on: string };
  ageGroup: string | null;
  fixtures: FixtureFact[];
}): PlanWeek[] {
  const bracket = ageBracket(input.ageGroup);
  const first = weekKeyFor(input.term.starts_on);
  const keys: string[] = [];
  for (let k = first; k <= input.term.ends_on; k = addDays(k, 7)) keys.push(k);

  const used: Record<Corner, number> = { technical: 0, tactical: 0, physical: 0, psychological: 0 };
  return keys.map((weekKey, index) => {
    const load = loadFor(index, keys.length);
    const fixtures = input.fixtures
      .filter((f) => f.date >= weekKey && f.date <= addDays(weekKey, 6))
      .sort((a, b) => a.date.localeCompare(b.date) || a.opponent.localeCompare(b.opponent));
    const corner = CORNERS[index % CORNERS.length];
    const themes = THEMES[corner][bracket];
    const theme = themes[used[corner]++ % themes.length];
    const [wedLoad, friLoad] = intensities(load, fixtures.length > 0);

    const wed: PlannedSession = {
      date: addDays(weekKey, 2), weekday: "Wednesday",
      title: `${CORNER_LABELS[corner]}: ${theme}`.slice(0, 120),
      type: load === "lighter" ? "general" : CORNER_TYPE[corner],
      intensity: wedLoad,
      notes: `Week ${index + 1} of the term plan (${LOAD_LABELS[load]}). Effort: ${wedLoad.toLowerCase()}. Edit freely.`,
    };
    const next = fixtures[0];
    let friType: SessionType = CORNER_TYPE[corner];
    if (next) friType = "match_prep";
    if (load === "lighter") friType = "recovery";
    const fri: PlannedSession = {
      date: addDays(weekKey, 4), weekday: "Friday",
      title: next ? `Match prep: ${next.opponent}` : `${CORNER_LABELS[corner]}: games to finish the week`,
      type: friType,
      intensity: friLoad,
      notes: next
        ? `Get ready for ${next.opponent} on ${dayMonth(next.date)}. Effort: ${friLoad.toLowerCase()}. Edit freely.`
        : `Week ${index + 1} of the term plan (${LOAD_LABELS[load]}). Effort: ${friLoad.toLowerCase()}. Edit freely.`,
    };
    const sessions = [wed, fri].filter((s) => s.date >= input.term.starts_on && s.date <= input.term.ends_on);
    return { index, weekKey, load, corner, fixtures, note: LOAD_NOTES[load], sessions };
  });
}

/** The term to plan: the running one, or the next when the running one is about to end. */
export function planningTerm<T extends { starts_on: string; ends_on: string }>(terms: T[], today: string): T | null {
  const sorted = [...terms].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const running = sorted.find((t) => t.starts_on <= today && today <= t.ends_on);
  const next = sorted.find((t) => t.starts_on > today);
  if (running && next && addDays(today, 7) >= running.ends_on) return next;
  return running ?? next ?? sorted.at(-1) ?? null;
}
