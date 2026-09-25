import { validateCounter, counterExploits, counterRunShapes, tallyOpponentFormations } from "@/lib/opponent-counter";
import { parseJsonObject } from "@/lib/ai-json";
import { zoneCentre } from "@/lib/board-analysis";

const good = {
  reading: "They sit in a flat 4-4-2 with a big gap between the lines.",
  exploits: [
    { zoneId: "A-C", why: "Pocket between the lines.", howTo: "Drop the 9 in." },
    { zoneId: "Q-99", why: "made up", howTo: "nope" },
  ],
  counterFormationId: "11-4-2-3-1",
  counterFormationWhy: "A 10 lives in that pocket.",
  counterRuns: [
    { fromZoneId: "M-C", toZoneId: "A-C", kind: "run", note: "10 drops in" },
    { fromZoneId: "M-RW", toZoneId: "A-RW", kind: "sprint", note: "unknown kind" },
    { fromZoneId: "M-LW", toZoneId: "M-LW", kind: "run", note: "goes nowhere" },
    { fromZoneId: "D-C", toZoneId: "M-LHS", kind: "pass", note: "switch" },
  ],
  watchOut: ["Their front two press high.", "Long balls in behind.", "Set pieces.", "a fourth"],
  trainThisWeek: "**Rondo** through the lines.",
};

describe("parseJsonObject", () => {
  it("parses JSON wrapped in prose, and gives up cleanly on garbage", () => {
    expect(parseJsonObject('Sure! {"a": 1} hope that helps')).toEqual({ a: 1 });
    expect(parseJsonObject("not json at all")).toBeNull();
    expect(parseJsonObject("")).toBeNull();
  });
});

describe("validateCounter", () => {
  it("keeps valid zones, runs and formation and drops everything invented", () => {
    const c = validateCounter(good, 11)!;
    expect(c.exploits.map((e) => e.zoneId)).toEqual(["A-C"]);
    expect(c.counterRuns.map((r) => `${r.fromZoneId}>${r.toZoneId}:${r.kind}`)).toEqual(["M-C>A-C:run", "D-C>M-LHS:pass"]);
    expect(c.counterFormationId).toBe("11-4-2-3-1");
    expect(c.watchOut).toHaveLength(3);
    expect(c.trainThisWeek).toBe("Rondo through the lines.");
  });

  it("rejects a formation the app doesn't have, or of the wrong size", () => {
    expect(validateCounter({ ...good, counterFormationId: "4-6-0" }, 11)!.counterFormationId).toBeNull();
    const wrongSize = validateCounter(good, 7)!;
    expect(wrongSize.counterFormationId).toBeNull();
    expect(wrongSize.counterFormationWhy).toBe("");
  });

  it("returns null for malformed or empty replies", () => {
    expect(validateCounter(null)).toBeNull();
    expect(validateCounter({ exploits: "lots", counterRuns: 3 })).toBeNull();
  });
});

describe("counterExploits", () => {
  it("turns AI zones into overlay exploits", () => {
    const [e] = counterExploits(validateCounter(good, 11)!);
    expect(e).toEqual(expect.objectContaining({ source: "ai", kind: "ai-target", zoneId: "A-C", severity: 3 }));
    expect(e.label).toBe("Attacking third, centre");
    expect(e.polygon).toHaveLength(4);
  });
});

describe("counterRunShapes", () => {
  const tokens = [
    { id: "gk", kind: "player" as const, group: "Goalkeeper", x: 50, y: 76 },
    { id: "cm", kind: "player" as const, group: "Midfielder", x: 50, y: 80 },
    { id: "cm2", kind: "player" as const, group: "Midfielder", x: 45, y: 82 },
    { id: "opp", kind: "opponent" as const, group: "Opponent", x: 50, y: 75 },
  ];

  it("starts a run on our nearest outfield player and never reuses one", () => {
    const shapes = counterRunShapes(
      [
        { fromZoneId: "M-C", toZoneId: "A-C", kind: "run", note: "" },
        { fromZoneId: "M-C", toZoneId: "A-LHS", kind: "dribble", note: "" },
      ],
      tokens
    );
    expect(shapes[0].pts[0]).toEqual({ x: 50, y: 80 });
    expect(shapes[1].pts[0]).toEqual({ x: 45, y: 82 });
    expect(shapes[0].pts[1]).toEqual(zoneCentre("A-C"));
    expect(new Set(shapes.map((s) => s.id)).size).toBe(2);
  });

  it("starts a pass from the zone itself", () => {
    const [s] = counterRunShapes([{ fromZoneId: "D-C", toZoneId: "M-LHS", kind: "pass", note: "" }], tokens);
    expect(s.pts[0]).toEqual(zoneCentre("D-C"));
    expect(s.kind).toBe("pass");
  });
});

describe("tallyOpponentFormations", () => {
  const opp = [{ kind: "opponent" }];
  it("counts only plays that showed the opponent, most used first", () => {
    const tally = tallyOpponentFormations([
      { awayFormationId: "11-4-4-2", tokens: opp },
      { awayFormationId: "11-3-5-2", tokens: opp },
      { awayFormationId: "11-3-5-2", tokens: opp },
      { awayFormationId: "11-4-4-2", tokens: [{ kind: "player" }] }, // default, never set up
      { awayFormationId: "made-up", tokens: opp },
      { tokens: opp },
    ]);
    expect(tally).toEqual([
      { formationId: "11-3-5-2", label: "3-5-2", count: 2 },
      { formationId: "11-4-4-2", label: "4-4-2", count: 1 },
    ]);
  });
});
