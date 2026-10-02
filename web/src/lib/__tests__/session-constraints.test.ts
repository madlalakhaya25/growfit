import { constraintLines, normaliseConstraints, typicalTurnout } from "../session-constraints";

describe("normaliseConstraints", () => {
  it("keeps good values and drops space and kit that aren't on the lists", () => {
    expect(normaliseConstraints({ squadSize: 14, durationMinutes: 60, space: "half", kit: ["balls", "cones"] }))
      .toEqual({ squadSize: 14, durationMinutes: 60, space: "half", kit: ["balls", "cones"] });
    const bad = normaliseConstraints({ squadSize: 14, durationMinutes: 60, space: "the moon", kit: ["balls", "jetpack"] });
    expect(bad.space).toBeUndefined();
    expect(bad.kit).toEqual(["balls"]);
  });
  it("clamps counts and minutes and falls back on nonsense", () => {
    expect(normaliseConstraints({ squadSize: 999, durationMinutes: 1 })).toMatchObject({ squadSize: 40, durationMinutes: 20 });
    expect(normaliseConstraints({ squadSize: -3, durationMinutes: 9999 })).toMatchObject({ squadSize: 4, durationMinutes: 150 });
    expect(normaliseConstraints({ squadSize: "x", durationMinutes: undefined })).toMatchObject({ squadSize: 16, durationMinutes: 75 });
  });
  it("tells unspecified kit from an empty kit list", () => {
    expect(normaliseConstraints({ squadSize: 12, durationMinutes: 60 }).kit).toBeUndefined();
    expect(normaliseConstraints({ squadSize: 12, durationMinutes: 60, kit: [] }).kit).toEqual([]);
    expect(normaliseConstraints({ squadSize: 12, durationMinutes: 60, kit: "balls" }).kit).toBeUndefined();
  });
});

describe("constraintLines", () => {
  const text = (o: Parameters<typeof normaliseConstraints>[0]) => constraintLines(normaliseConstraints(o)).join("\n");
  it("always states the players and the time", () => {
    const t = text({ squadSize: 13, durationMinutes: 60 });
    expect(t).toContain("Players available: 13");
    expect(t).toContain("60 minutes");
    expect(t).not.toMatch(/Space:|Kit available/);
  });
  it("limits the session to the kit that was ticked", () => {
    const t = text({ squadSize: 13, durationMinutes: 60, kit: ["balls", "cones"] });
    expect(t).toContain("balls, cones");
    expect(t).toMatch(/ONLY this kit/);
  });
  it("says so when there is no kit at all, and names the space", () => {
    const t = text({ squadSize: 13, durationMinutes: 60, kit: [], space: "tight" });
    expect(t).toMatch(/none beyond the players/);
    expect(t).toMatch(/yard, court or car park/);
  });
});

describe("typicalTurnout", () => {
  it("is the median of the last three sessions that have marks", () => {
    expect(typicalTurnout([12, 16, 14, 30])).toBe(14);
    expect(typicalTurnout([10, 12])).toBe(11);
    expect(typicalTurnout([15])).toBe(15);
  });
  it("skips sessions nobody was marked at, and is null with nothing to go on", () => {
    expect(typicalTurnout([0, 12, 0, 14, 16, 99])).toBe(14);
    expect(typicalTurnout([0, 0])).toBeNull();
    expect(typicalTurnout([])).toBeNull();
  });
  it("stays inside the form's bounds", () => {
    expect(typicalTurnout([2, 2, 2])).toBe(4);
    expect(typicalTurnout([90, 90, 90])).toBe(40);
  });
});
