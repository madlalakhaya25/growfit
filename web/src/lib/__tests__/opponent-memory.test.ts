import { normaliseOpponent, selectMeetings, type OpponentFixtureRow } from "../opponent-memory";
import { buildScoutingBrief, hasNoScoutingHistory } from "../scouting-brief";

const fx = (id: string, opponent: string, date: string, over: Partial<OpponentFixtureRow> = {}): OpponentFixtureRow => ({
  id, opponent, fixture_date: date, is_home: true, status: "completed",
  match_results: { team_score: 2, opponent_score: 1, match_notes: null }, ...over,
});

describe("normaliseOpponent", () => {
  it("folds case and whitespace and nothing else", () => {
    expect(normaliseOpponent("  Umlazi   Rovers ")).toBe("umlazi rovers");
    expect(normaliseOpponent("UMLAZI ROVERS")).toBe("umlazi rovers");
    // never fuzzy: these are different opponents until a person says otherwise
    expect(normaliseOpponent("Umlazi Rovers FC")).not.toBe(normaliseOpponent("Umlazi Rovers"));
    expect(normaliseOpponent("Umlazi Rovers")).not.toBe(normaliseOpponent("Umlazi Rover"));
  });
});

describe("selectMeetings", () => {
  const all = [
    fx("a", "Umlazi Rovers", "2026-03-01T10:00:00Z"),
    fx("b", "umlazi  rovers", "2026-05-01T10:00:00Z", { match_results: { team_score: 0, opponent_score: 3, match_notes: "x".repeat(500) } }),
    fx("c", "Umlazi Rovers FC", "2026-06-01T10:00:00Z"),
    fx("d", "Umlazi Rovers", "2026-07-01T10:00:00Z", { status: "upcoming" }),
    fx("e", "Umlazi Rovers", "2026-04-01T10:00:00Z", { match_results: null }),
  ];
  it("finds completed meetings by normalised name, newest first, and never a different club", () => {
    const m = selectMeetings(all, "UMLAZI ROVERS");
    expect(m.map((x) => x.fixtureId)).toEqual(["b", "e", "a"]);
  });
  it("excludes the fixture being planned, upcoming fixtures and caps notes", () => {
    expect(selectMeetings(all, "Umlazi Rovers", { excludeFixtureId: "b" }).map((x) => x.fixtureId)).toEqual(["e", "a"]);
    expect(selectMeetings(all, "Umlazi Rovers")[0].notes).toHaveLength(200);
  });
  it("reports a completed fixture with no logged score as a null score, not 0-0", () => {
    expect(selectMeetings(all, "Umlazi Rovers").find((x) => x.fixtureId === "e")!.score).toBeNull();
  });
  it("is independent of input order and honours the limit", () => {
    expect(selectMeetings([...all].reverse(), "Umlazi Rovers").map((x) => x.fixtureId)).toEqual(["b", "e", "a"]);
    expect(selectMeetings(all, "Umlazi Rovers", { limit: 1 })).toHaveLength(1);
  });
  it("returns nothing for a blank opponent", () => {
    expect(selectMeetings(all, "   ")).toEqual([]);
  });
});

describe("buildScoutingBrief", () => {
  const meetings = selectMeetings([fx("a", "Rovers", "2026-03-01T10:00:00Z")], "Rovers");
  it("is deterministic and states only what is logged", () => {
    const a = buildScoutingBrief({ teamName: "U13", opponent: "Rovers", meetings, formations: [{ formationId: "f", label: "4-4-2", count: 2 }] });
    const b = buildScoutingBrief({ teamName: "U13", opponent: "Rovers", meetings: [...meetings], formations: [{ formationId: "f", label: "4-4-2", count: 2 }] });
    expect(a).toBe(b);
    expect(a).toContain("2-1");
    expect(a).toContain("4-4-2 (2 plays)");
  });
  it("says plainly when nothing is logged", () => {
    const t = buildScoutingBrief({ teamName: "U13", opponent: "Rovers", meetings: [], formations: [] });
    expect(t).toContain("none logged");
    expect(t).toContain("none saved");
    expect(hasNoScoutingHistory([], [])).toBe(true);
    expect(hasNoScoutingHistory(meetings, [])).toBe(false);
  });
});
