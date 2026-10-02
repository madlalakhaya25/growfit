import { buildCurves, monthSlots, type CurveInput } from "../curves";

const NOW = new Date("2026-10-15T10:00:00Z");
const empty: CurveInput = { ratings: [], attendance: [], milestones: [] };

describe("monthSlots", () => {
  it("is the last six months, oldest first, across a year end", () => {
    expect(monthSlots(new Date("2026-02-10T00:00:00Z")).map((s) => s.key)).toEqual([
      "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });
});

describe("buildCurves", () => {
  it("says nothing when there is no data", () => {
    const c = buildCurves(empty, NOW);
    expect(c.reading).toEqual({ rating: null, attendance: null, milestones: null });
    expect(c.points).toHaveLength(6);
  });

  it("averages ratings and computes attendance per month, leaving excused out", () => {
    const c = buildCurves({
      ratings: [{ date: "2026-10-02", rating: 4 }, { date: "2026-10-09", rating: 3 }],
      attendance: [
        { date: "2026-10-01", status: "present" }, { date: "2026-10-03", status: "late" },
        { date: "2026-10-08", status: "absent" }, { date: "2026-10-10", status: "excused" },
      ],
      milestones: ["2026-10-05"],
    }, NOW);
    expect(c.points.at(-1)).toMatchObject({ key: "2026-10", rating: 3.5, attendancePct: 67, milestones: 1 });
  });

  it("ignores marks that are not a register status", () => {
    const c = buildCurves({ ...empty, attendance: [{ date: "2026-10-01", status: "attending" }, { date: "2026-10-02", status: "present" }] }, NOW);
    expect(c.points.at(-1)!.attendancePct).toBe(100);
  });

  it("reads a rise in ratings and a fall in attendance in words", () => {
    const c = buildCurves({
      ratings: [{ date: "2026-05-10", rating: 2 }, { date: "2026-06-10", rating: 3 }, { date: "2026-08-10", rating: 4 }, { date: "2026-10-10", rating: 5 }],
      attendance: [
        { date: "2026-05-05", status: "present" }, { date: "2026-06-05", status: "present" },
        { date: "2026-08-05", status: "absent" }, { date: "2026-10-05", status: "absent" },
      ],
      milestones: [],
    }, NOW);
    expect(c.directions).toMatchObject({ rating: "up", attendance: "down" });
    expect(c.reading.rating).toBe("Match ratings are up, from 2.5 to 4.5 over the last three months against the three before.");
    expect(c.reading.attendance).toBe("Training attendance is down, from 100% to 0%.");
  });

  it("calls a small change steady, not a trend", () => {
    const c = buildCurves({
      ratings: [{ date: "2026-05-10", rating: 4 }, { date: "2026-09-10", rating: 4.2 }],
      attendance: [], milestones: [],
    }, NOW);
    expect(c.directions.rating).toBe("steady");
    expect(c.reading.rating).toContain("steady");
  });

  it("gives no reading when only one half has data", () => {
    const c = buildCurves({ ratings: [{ date: "2026-10-10", rating: 4 }], attendance: [], milestones: [] }, NOW);
    expect(c.directions.rating).toBe("unknown");
    expect(c.reading.rating).toBeNull();
  });

  it("compares milestone counts across the two halves", () => {
    const c = buildCurves({ ...empty, milestones: ["2026-06-01", "2026-09-01", "2026-09-20", "2026-10-02"] }, NOW);
    expect(c.directions.milestones).toBe("up");
    expect(c.reading.milestones).toBe("More milestones lately: 3 in the last three months, against 1 before.");
  });

  it("ignores anything older than the six months", () => {
    const c = buildCurves({ ...empty, ratings: [{ date: "2025-01-01", rating: 1 }] }, NOW);
    expect(c.points.every((p) => p.rating === null)).toBe(true);
  });
});
