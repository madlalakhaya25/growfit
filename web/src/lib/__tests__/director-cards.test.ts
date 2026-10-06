import { coverageHeadlines, objectivesByTeam, sessionsByTeam } from "../director-cards";
import type { OpenObjective } from "../objectives";
import type { AgeGroupCoverage } from "../curriculum-coverage";

const teams = [{ id: "t1", name: "U11" }, { id: "t2", name: "U13" }, { id: "t3", name: "U15" }];
const obj = (id: string, teamId: string, createdAt: string, linkedCount = 0): OpenObjective => ({
  id, teamId, phase: null, problem: "p", objective: "o", createdAt, sourceFixtureId: null, linkedCount,
});

describe("objectivesByTeam", () => {
  it("counts open objectives per team and those with no training after a week", () => {
    const open = [
      obj("a", "t1", "2026-09-20T10:00:00Z"),
      obj("b", "t1", "2026-10-05T10:00:00Z"),
      obj("c", "t2", "2026-09-20T10:00:00Z", 1),
    ];
    expect(objectivesByTeam(teams, open, "2026-10-06")).toEqual([
      { teamId: "t1", name: "U11", open: 2, noTrainingYet: 1 },
      { teamId: "t2", name: "U13", open: 1, noTrainingYet: 0 },
    ]);
  });

  it("leaves out teams with nothing open and puts the most waiting first", () => {
    const open = [obj("a", "t2", "2026-09-01T10:00:00Z"), obj("b", "t1", "2026-09-01T10:00:00Z", 2)];
    expect(objectivesByTeam(teams, open, "2026-10-06").map((l) => l.teamId)).toEqual(["t2", "t1"]);
    expect(objectivesByTeam(teams, [], "2026-10-06")).toEqual([]);
  });
});

describe("sessionsByTeam", () => {
  const window = { from: "2026-07-20", to: "2026-10-06" };

  it("counts sessions inside the window only, fewest first", () => {
    const sessions = [
      { teamId: "t1", date: "2026-08-01" }, { teamId: "t1", date: "2026-08-08" },
      { teamId: "t2", date: "2026-09-01" },
      { teamId: "t2", date: "2026-07-19" }, { teamId: "t2", date: "2026-10-07" },
    ];
    expect(sessionsByTeam(teams, sessions, window)).toEqual([
      { teamId: "t3", name: "U15", sessions: 0 },
      { teamId: "t2", name: "U13", sessions: 1 },
      { teamId: "t1", name: "U11", sessions: 2 },
    ]);
  });

  it("includes both edges of the window", () => {
    const edges = [{ teamId: "t1", date: "2026-07-20" }, { teamId: "t1", date: "2026-10-06" }];
    expect(sessionsByTeam(teams, edges, window).find((l) => l.teamId === "t1")?.sessions).toBe(2);
  });
});

describe("coverageHeadlines", () => {
  it("summarises each age group", () => {
    const item = (sessions: number) => ({ item: {} as never, sessions, objectives: 0, lastTrained: null });
    const group: AgeGroupCoverage = {
      ageGroup: "U13",
      categories: [{ category: "technical", items: [item(1), item(0)] }, { category: "tactical", items: [item(0)] }],
      notTouched: [item(0), item(0)],
      coveragePercent: 33,
    };
    expect(coverageHeadlines([group])).toEqual([{ ageGroup: "U13", percent: 33, notTouched: 2, items: 3 }]);
  });
});
