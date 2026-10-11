import {
  cleanPosterRows, isOurTeam, kickoffIso, localDay, matchPosterRows, normaliseTeamName, rowOpponent, rowScores,
  type PosterRow,
} from "../match-poster";

const row = (over: Partial<PosterRow> = {}): PosterRow => ({
  key: "p0", homeTeam: "Growfit FA", awayTeam: "Rovers FC", homeScore: null, awayScore: null,
  date: "2026-10-18", time: "09:00", venue: null, ageGroup: null, usIsHome: true, ...over,
});

describe("team names", () => {
  it("ignores club words and punctuation", () => {
    expect(normaliseTeamName("Rovers F.C. U13")).toBe("rovers");
    expect(normaliseTeamName("Umlazi Sports Academy")).toBe("umlazi");
  });
  it("knows our side by 'growfit' or the academy name", () => {
    expect(isOurTeam("GROWFIT Sports Academy", null)).toBe(true);
    expect(isOurTeam("Pinetown Stars", "Pinetown Stars FC")).toBe(true);
    expect(isOurTeam("Rovers", "Growfit Sports Academy")).toBe(false);
  });
});

describe("cleanPosterRows", () => {
  it("keeps good dates and times, drops bad ones, and works out our side", () => {
    const rows = cleanPosterRows([
      { home_team: "Rovers", away_team: "Growfit FA", home_score: 1, away_score: 3, date: "2026-02-31", time: "25:00", venue: "null" },
      { home_team: "Growfit FA", away_team: "Stars", date: "2026-10-18", time: "09:30" },
    ], "Growfit Sports Academy");
    expect(rows[0]).toMatchObject({ date: null, time: null, venue: null, usIsHome: false, homeScore: 1, awayScore: 3 });
    expect(rows[1]).toMatchObject({ date: "2026-10-18", time: "09:30", usIsHome: true });
  });
  it("leaves the side unset when neither or both names look like ours", () => {
    const rows = cleanPosterRows([{ home_team: "A", away_team: "B" }, { home_team: "Growfit 1", away_team: "Growfit 2" }], null);
    expect(rows.map((r) => r.usIsHome)).toEqual([null, null]);
  });
  it("drops rows missing a team and non-integer scores", () => {
    const rows = cleanPosterRows([{ home_team: "A" }, "x", { home_team: "A", away_team: "B", home_score: 2.5, away_score: 99 }], null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ homeScore: null, awayScore: null });
  });
  it("returns nothing for a non-list", () => {
    expect(cleanPosterRows({}, null)).toEqual([]);
  });
});

describe("orientation", () => {
  it("gives our score first whichever side we are", () => {
    expect(rowScores(row({ homeScore: 3, awayScore: 1, usIsHome: true }))).toEqual({ team: 3, opponent: 1 });
    expect(rowScores(row({ homeScore: 3, awayScore: 1, usIsHome: false }))).toEqual({ team: 1, opponent: 3 });
  });
  it("gives no score until the side is known or when none is printed", () => {
    expect(rowScores(row({ homeScore: 3, awayScore: 1, usIsHome: null }))).toBeNull();
    expect(rowScores(row())).toBeNull();
  });
  it("picks the other team as the opponent", () => {
    expect(rowOpponent(row({ usIsHome: false, homeTeam: "Rovers", awayTeam: "Growfit FA" }))).toBe("Rovers");
    expect(rowOpponent(row())).toBe("Rovers FC");
  });
});

describe("kickoff", () => {
  it("is South African time", () => {
    expect(kickoffIso("2026-10-18", "09:00")).toBe("2026-10-18T07:00:00.000Z");
  });
  it("finds the local day of a late kick-off", () => {
    expect(localDay("2026-10-18T22:30:00Z")).toBe("2026-10-19");
  });
});

describe("matchPosterRows", () => {
  const fx = [
    { id: "f1", opponent: "Rovers", fixture_date: "2026-10-18T07:00:00Z", status: "upcoming" },
    { id: "f2", opponent: "Stars", fixture_date: "2026-10-25T07:00:00Z", status: "completed" },
  ];
  it("matches on opponent and a date within a day", () => {
    const [a, b] = matchPosterRows([row(), row({ key: "p1", awayTeam: "Rovers", date: "2026-11-30" })], fx, "U13");
    expect(a.fixtureId).toBe("f1");
    expect(b.fixtureId).toBeNull();
  });
  it("claims each fixture once", () => {
    const out = matchPosterRows([row(), row({ key: "p1" })], fx, "U13");
    expect(out.map((r) => r.fixtureId)).toEqual(["f1", null]);
  });
  it("with no date, matches a single open fixture for that opponent", () => {
    expect(matchPosterRows([row({ date: null })], fx, "U13")[0].fixtureId).toBe("f1");
  });
  it("tries both names when the side is unclear", () => {
    const out = matchPosterRows([row({ usIsHome: null, homeTeam: "Rovers", awayTeam: "Mystery" })], fx, "U13");
    expect(out[0].fixtureId).toBe("f1");
  });
  it("flags another age group and carries the fixture status", () => {
    const [a] = matchPosterRows([row({ ageGroup: "Under 15 — U15" })], fx, "U13 Level 2");
    expect(a.otherAgeGroup).toBe(true);
    const [b] = matchPosterRows([row({ ageGroup: "U13", awayTeam: "Stars", date: "2026-10-25" })], fx, "U13");
    expect(b).toMatchObject({ otherAgeGroup: false, fixtureStatus: "completed" });
  });
});
