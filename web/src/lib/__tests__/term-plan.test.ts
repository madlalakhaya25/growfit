import { buildTermPlan, loadFor, planningTerm } from "../term-plan";

const TERM4 = { starts_on: "2026-10-13", ends_on: "2026-12-09" }; // Tuesday to Wednesday

describe("loadFor", () => {
  it("settles first, eases every fourth week, finishes last, else builds", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => loadFor(i, 9))).toEqual(
      ["settle", "build", "build", "lighter", "build", "build", "build", "lighter", "finish"],
    );
  });
  it("does not call a two-week term's last week a finish", () => {
    expect(loadFor(1, 2)).toBe("build");
  });
});

describe("buildTermPlan", () => {
  const weeks = buildTermPlan({ term: TERM4, ageGroup: "U13", fixtures: [{ date: "2026-10-18", opponent: "Hawks" }] });

  it("covers the term from the Monday of its first week, one entry per week", () => {
    expect(weeks).toHaveLength(9);
    expect(weeks[0].weekKey).toBe("2026-10-12");
    expect(weeks[8].weekKey).toBe("2026-12-07");
  });

  it("puts sessions on Wednesday and Friday and drops any outside the term", () => {
    expect(weeks[0].sessions.map((s) => [s.weekday, s.date])).toEqual([["Wednesday", "2026-10-14"], ["Friday", "2026-10-16"]]);
    expect(weeks[8].sessions.map((s) => s.date)).toEqual(["2026-12-09"]); // Friday 11 Dec is after term
  });

  it("starts gently and eases off every fourth week", () => {
    expect(weeks[0].load).toBe("settle");
    expect(weeks[0].sessions.map((s) => s.intensity)).toEqual(["Easy", "Moderate"]);
    expect(weeks[3].load).toBe("lighter");
    expect(weeks[3].sessions.map((s) => s.intensity)).toEqual(["Easy", "Easy"]);
    expect(weeks[3].sessions[1].type).toBe("recovery");
  });

  it("ties Friday to the weekend's match, and softens it before a match", () => {
    expect(weeks[0].fixtures).toEqual([{ date: "2026-10-18", opponent: "Hawks" }]);
    expect(weeks[0].sessions[1]).toMatchObject({ title: "Match prep: Hawks", type: "match_prep" });
    expect(weeks[1].sessions.map((s) => s.intensity)).toEqual(["Hard", "Hard"]); // no match in week 2
    const matchWeek = buildTermPlan({ term: TERM4, ageGroup: "U13", fixtures: [{ date: "2026-10-25", opponent: "Eagles" }] })[1];
    expect(matchWeek.sessions.map((s) => s.intensity)).toEqual(["Hard", "Moderate"]);
  });

  it("rotates the four corners and varies the theme each time a corner comes round", () => {
    expect(weeks.slice(0, 5).map((w) => w.corner)).toEqual(["technical", "tactical", "physical", "psychological", "technical"]);
    expect(weeks[0].sessions[0].title).not.toBe(weeks[4].sessions[0].title);
  });

  it("words the physical corner for the age group", () => {
    const u11 = buildTermPlan({ term: TERM4, ageGroup: "U11", fixtures: [] })[2].sessions[0].title;
    const u15 = buildTermPlan({ term: TERM4, ageGroup: "U15", fixtures: [] })[2].sessions[0].title;
    expect(u11).toMatch(/games/i);
    expect(u15).toMatch(/speed|agility|strength/i);
    expect(u11).not.toBe(u15);
  });

  it("is the same every time for the same inputs", () => {
    expect(buildTermPlan({ term: TERM4, ageGroup: "U13", fixtures: [] })).toEqual(buildTermPlan({ term: TERM4, ageGroup: "U13", fixtures: [] }));
  });
});

describe("planningTerm", () => {
  const terms = [
    { starts_on: "2026-07-21", ends_on: "2026-10-02" },
    { starts_on: "2026-10-13", ends_on: "2026-12-09" },
  ];
  it("plans the running term mid-term, and the next one in its last week", () => {
    expect(planningTerm(terms, "2026-08-20")).toBe(terms[0]);
    expect(planningTerm(terms, "2026-09-26")).toBe(terms[1]);
    expect(planningTerm(terms, "2026-10-05")).toBe(terms[1]); // between terms
  });
  it("falls back to the last term, and is null with none", () => {
    expect(planningTerm(terms, "2027-01-10")).toBe(terms[1]);
    expect(planningTerm([], "2026-10-05")).toBeNull();
  });
});
