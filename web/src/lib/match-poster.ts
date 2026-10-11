/**
 * Reading a match poster: the pure parts.
 *
 * Gemini returns what is printed on the poster, side by side ("home team,
 * away team, home score, away score"). Everything that decides what the app
 * does with it, which side is ours, which existing fixture it is, what a score
 * means for us, lives here so it can be tested without a model.
 */

import { TIMEZONE } from "@/lib/time";

/** One match as read off the poster, before the coach has reviewed it. */
export interface PosterRow {
  /** Stable id for the review list. */
  key: string;
  homeTeam: string;
  awayTeam: string;
  /** Score as printed, home side first. Null when the poster shows none. */
  homeScore: number | null;
  awayScore: number | null;
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:MM, 24 hour */
  time: string | null;
  venue: string | null;
  /** Age group as printed, e.g. "U13". */
  ageGroup: string | null;
  /** True when our side is the home team, false when away, null when unclear. */
  usIsHome: boolean | null;
}

/** A poster row plus what the app already knows about it. */
export interface PosterMatchRow extends PosterRow {
  /** An existing fixture this row most likely describes. */
  fixtureId: string | null;
  fixtureStatus: string | null;
  /** Poster names an age group other than this team's, so it is probably another squad's match. */
  otherAgeGroup: boolean;
}

export interface ExistingFixture {
  id: string;
  opponent: string;
  fixture_date: string;
  status: string;
}

const clean = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.toLowerCase() !== "null" ? s : null;
};

const cleanScore = (v: unknown): number | null => {
  let n = Number.NaN;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && /^\d{1,2}$/.test(v.trim())) n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 30 ? n : null;
};

/** True for a real calendar date, so "2026-02-31" does not pass. */
export function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

export function isRealTime(hm: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hm);
}

/** Lower-case, no punctuation or club words, so "Rovers F.C." matches "rovers". */
export function normaliseTeamName(name: string): string {
  const stop = new Set(["fc", "afc", "sc", "football", "club", "academy", "sports", "united", "utd"]);
  return name
    .toLowerCase()
    .replaceAll(".", "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !stop.has(w) && !/^u\d{1,2}$/.test(w))
    .join(" ");
}

function sameTeam(a: string, b: string): boolean {
  const x = normaliseTeamName(a);
  const y = normaliseTeamName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** Whether a team name on the poster is ours: the academy's own name, or "growfit". */
export function isOurTeam(name: string, academyName: string | null): boolean {
  const n = name.toLowerCase();
  if (n.includes("growfit")) return true;
  return !!academyName && sameTeam(name, academyName) && normaliseTeamName(academyName).length >= 3;
}

/** The team on the other side of the match. Unclear sides default to the away team. */
export function rowOpponent(row: Pick<PosterRow, "homeTeam" | "awayTeam" | "usIsHome">): string {
  return row.usIsHome === false ? row.homeTeam : row.awayTeam;
}

/** Our score and theirs, as the poster printed them oriented to our side. Null until the side is known. */
export function rowScores(
  row: Pick<PosterRow, "homeScore" | "awayScore" | "usIsHome">,
): { team: number; opponent: number } | null {
  if (row.usIsHome === null || row.homeScore === null || row.awayScore === null) return null;
  return row.usIsHome
    ? { team: row.homeScore, opponent: row.awayScore }
    : { team: row.awayScore, opponent: row.homeScore };
}

/** Kick-off as an ISO instant. South Africa has no daylight saving, so +02:00 is always right. */
export function kickoffIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+02:00`).toISOString();
}

/** The calendar day of an instant in the academy's timezone, as YYYY-MM-DD. */
export function localDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

function dayDiff(a: string, b: string): number {
  return Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000;
}

/**
 * Clean Gemini's answer into rows. Drops anything without two team names,
 * keeps only dates and times in the shape asked for, and works out which side
 * is ours from the team names.
 */
export function cleanPosterRows(raw: unknown, academyName: string | null): PosterRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: PosterRow[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const r = item as Record<string, unknown>;
    const homeTeam = clean(r.home_team);
    const awayTeam = clean(r.away_team);
    if (!homeTeam || !awayTeam) return;

    const date = clean(r.date);
    const time = clean(r.time);
    const homeIsUs = isOurTeam(homeTeam, academyName);
    const awayIsUs = isOurTeam(awayTeam, academyName);
    rows.push({
      key: `p${i}`,
      homeTeam,
      awayTeam,
      homeScore: cleanScore(r.home_score),
      awayScore: cleanScore(r.away_score),
      date: date && isRealDate(date) ? date : null,
      time: time && isRealTime(time) ? time : null,
      venue: clean(r.venue),
      ageGroup: clean(r.age_group),
      // Both or neither matching is not a decision the code should make.
      usIsHome: homeIsUs === awayIsUs ? null : homeIsUs,
    });
  });
  return rows;
}

function ageGroupOf(text: string): string | null {
  const m = /u\s?-?(\d{1,2})/i.exec(text);
  return m ? `U${m[1]}` : null;
}

/**
 * Pair each poster row with the fixture it most likely describes, and flag
 * rows that name another age group.
 *
 * A match needs the same opponent and a date within a day of the existing
 * fixture (kick-off times shift, the day rarely does). When the poster shows
 * no date, an opponent that appears in exactly one open fixture is enough.
 * Each fixture is claimed once.
 */
export function matchPosterRows(
  rows: PosterRow[],
  fixtures: ExistingFixture[],
  teamAgeGroup: string | null,
): PosterMatchRow[] {
  const claimed = new Set<string>();
  const teamAge = teamAgeGroup ? ageGroupOf(teamAgeGroup) : null;

  return rows.map((row) => {
    const names = row.usIsHome === null ? [row.homeTeam, row.awayTeam] : [rowOpponent(row)];
    const candidates = fixtures.filter(
      (f) => !claimed.has(f.id) && names.some((n) => sameTeam(n, f.opponent)),
    );

    let hit: ExistingFixture | undefined;
    if (row.date) {
      hit = candidates.find((f) => dayDiff(localDay(f.fixture_date), row.date!) <= 1);
    } else {
      const open = candidates.filter((f) => f.status === "upcoming" || f.status === "postponed");
      if (open.length === 1) hit = open[0];
    }
    if (hit) claimed.add(hit.id);

    const rowAge = row.ageGroup ? ageGroupOf(row.ageGroup) : null;
    return {
      ...row,
      fixtureId: hit?.id ?? null,
      fixtureStatus: hit?.status ?? null,
      otherAgeGroup: !!(teamAge && rowAge && rowAge !== teamAge),
    };
  });
}
