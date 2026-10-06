import {
  MAX_OPEN_OBJECTIVES,
  canOpenObjective,
  cleanObjectiveInput,
  defaultObjectiveText,
  linkedLabel,
  phaseLabel,
  planSessionHref,
  objectiveDebt,
  suggestPhase,
  verdictFromSeenAgain,
  verdictLabel,
  type FixtureRow,
  type ObjectiveRow,
} from "../objectives";

describe("verdictFromSeenAgain", () => {
  it("treats seeing the problem again as the bad outcome", () => {
    expect(verdictFromSeenAgain("no")).toBe("improved");
    expect(verdictFromSeenAgain("a_bit")).toBe("partly");
    expect(verdictFromSeenAgain("yes")).toBe("not_yet");
  });

  it("has a label for each verdict", () => {
    expect(verdictLabel("improved")).toBe("Improved");
    expect(verdictLabel("partly")).toBe("Partly");
    expect(verdictLabel("not_yet")).toBe("Not yet");
  });
});

describe("suggestPhase", () => {
  it("suggests the lowest-rated phase", () => {
    expect(suggestPhase({ in_possession: 4, out_of_possession: 2, set_pieces: 3 })).toBe("out_of_possession");
  });

  it("breaks a tie for the earlier phase in the fixed order", () => {
    expect(suggestPhase({ set_pieces: 2, attacking_transition: 2, in_possession: 5 })).toBe("attacking_transition");
  });

  it("suggests nothing when nothing stands out", () => {
    expect(suggestPhase(null)).toBeNull();
    expect(suggestPhase({})).toBeNull();
    expect(suggestPhase({ in_possession: 3 })).toBeNull();
    expect(suggestPhase({ in_possession: 3, set_pieces: 3 })).toBeNull();
  });
});

describe("canOpenObjective", () => {
  it("allows up to the limit and no more", () => {
    expect(MAX_OPEN_OBJECTIVES).toBe(2);
    expect(canOpenObjective(0)).toBe(true);
    expect(canOpenObjective(1)).toBe(true);
    expect(canOpenObjective(2)).toBe(false);
    expect(canOpenObjective(3)).toBe(false);
  });
});

describe("defaultObjectiveText", () => {
  it("builds from the problem and drops trailing punctuation", () => {
    expect(defaultObjectiveText("  We lose the ball playing out from the back. ")).toBe(
      "Work on: We lose the ball playing out from the back",
    );
  });

  it("never exceeds 200 characters", () => {
    expect(defaultObjectiveText("x".repeat(200))).toHaveLength(200);
  });
});

describe("cleanObjectiveInput", () => {
  it("keeps a valid problem and fills the objective from it", () => {
    expect(cleanObjectiveInput({ problem: "Slow to press", phase: "out_of_possession" })).toEqual({
      phase: "out_of_possession",
      problem: "Slow to press",
      problemKey: null,
      objective: "Work on: Slow to press",
      detail: null,
    });
  });

  it("keeps an objective the coach wrote", () => {
    const r = cleanObjectiveInput({ problem: "Slow to press", objective: " Press as a unit " });
    expect(r?.objective).toBe("Press as a unit");
  });

  it("drops an unknown phase instead of failing", () => {
    expect(cleanObjectiveInput({ problem: "x", phase: "shooting" })?.phase).toBeNull();
  });

  it("refuses a missing, blank or over-long problem", () => {
    expect(cleanObjectiveInput({})).toBeNull();
    expect(cleanObjectiveInput({ problem: "   " })).toBeNull();
    expect(cleanObjectiveInput({ problem: "x".repeat(201) })).toBeNull();
    expect(cleanObjectiveInput(null)).toBeNull();
    expect(cleanObjectiveInput([])).toBeNull();
  });

  it("refuses an over-long objective rather than cutting it", () => {
    expect(cleanObjectiveInput({ problem: "x", objective: "y".repeat(201) })).toBeNull();
  });

  it("keeps only the where, when and why that are usable", () => {
    expect(
      cleanObjectiveInput({ problem: "x", detail: { where: "Own half", when: "  ", why: 5, extra: "no" } })?.detail,
    ).toEqual({ where: "Own half" });
    expect(cleanObjectiveInput({ problem: "x", detail: {} })?.detail).toBeNull();
  });
});

const open = (over: Partial<ObjectiveRow>): ObjectiveRow => ({
  id: "o1",
  status: "open",
  createdAt: "2026-10-06T10:00:00Z",
  sourceFixtureId: "f1",
  verdict: null,
  linkedCount: 0,
  ...over,
});
const match = (over: Partial<FixtureRow>): FixtureRow => ({ id: "f2", date: "2026-10-13", played: true, ...over });

describe("objectiveDebt", () => {
  it("flags an objective with no training after the grace period", () => {
    expect(objectiveDebt([open({})], [], "2026-10-13")).toEqual([{ objectiveId: "o1", kind: "no_training_yet" }]);
  });

  it("leaves a new objective alone inside the grace period", () => {
    expect(objectiveDebt([open({})], [], "2026-10-12")).toEqual([]);
  });

  it("does not flag an objective that has training linked", () => {
    expect(objectiveDebt([open({ linkedCount: 1 })], [], "2026-10-20")).toEqual([]);
  });

  it("flags a missing follow-up once a later match was played", () => {
    expect(objectiveDebt([open({ linkedCount: 2 })], [match({})], "2026-10-14")).toEqual([
      { objectiveId: "o1", kind: "no_follow_up" },
    ]);
  });

  it("prefers the follow-up flag when both apply", () => {
    expect(objectiveDebt([open({})], [match({})], "2026-10-20")).toEqual([{ objectiveId: "o1", kind: "no_follow_up" }]);
  });

  it("ignores the match the objective came from, unplayed matches and earlier matches", () => {
    const fixtures = [
      match({ id: "f1", date: "2026-10-13" }),
      match({ id: "f3", played: false }),
      match({ id: "f4", date: "2026-10-01" }),
    ];
    expect(objectiveDebt([open({ linkedCount: 1 })], fixtures, "2026-10-20")).toEqual([]);
  });

  it("ignores closed objectives and ones that already have a verdict", () => {
    expect(objectiveDebt([open({ status: "closed" })], [match({})], "2026-10-30")).toEqual([]);
    expect(objectiveDebt([open({ verdict: "partly", linkedCount: 1 })], [match({})], "2026-10-30")).toEqual([]);
  });
});

describe("screen helpers", () => {
  const o = { id: "obj-1", teamId: "team-1", problem: "We lose it playing out from the back." };

  it("sends the coach to the new-session page with the team, objective and a cleaned focus", () => {
    const url = new URL(planSessionHref(o), "https://x.test");
    expect(url.pathname).toBe("/dashboard/coach/training/new");
    expect(url.searchParams.get("team")).toBe("team-1");
    expect(url.searchParams.get("objective")).toBe("obj-1");
    expect(url.searchParams.get("focus")).toBe("We lose it playing out from the back");
  });

  it("leaves the focus out when the problem has nothing usable in it", () => {
    expect(new URL(planSessionHref({ ...o, problem: "?" }), "https://x.test").searchParams.has("focus")).toBe(false);
  });

  it("says what has been planned", () => {
    expect(linkedLabel(0)).toBe("Nothing planned yet");
    expect(linkedLabel(1)).toBe("1 session or play planned");
    expect(linkedLabel(3)).toBe("3 sessions or plays planned");
  });

  it("names the phase, or nothing", () => {
    expect(phaseLabel("in_possession")).toBe("In possession");
    expect(phaseLabel(null)).toBeNull();
  });
});
