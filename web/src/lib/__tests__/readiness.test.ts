import { acuteChronicRatio, matchMinutesFor, ratingChange, readiness, type ReadinessInput } from "../readiness";

const NOW = new Date("2026-10-07T12:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const base = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
  ageGroup: "U13", sessions: [], matches: [], ratings: [], attendancePct: 0.9, ...over,
});
/** Sessions on the given days-ago, all attended and rated. */
const rated = (days: number[], rpe = 5) => days.map((d) => ({ date: ago(d), attended: true, rpe }));

describe("acuteChronicRatio", () => {
  it("is 1 when this week matches the usual week", () => {
    // Two sessions a week for four weeks, every one the same effort.
    const s = rated([1, 3, 8, 10, 15, 17, 22, 24]);
    expect(acuteChronicRatio(base({ sessions: s }), NOW)).toBe(1);
  });

  it("rises when this week is much harder than the weeks before", () => {
    const s = [...rated([1, 3], 9), ...rated([8, 10, 15, 17, 22, 24], 4)];
    expect(acuteChronicRatio(base({ sessions: s }), NOW)!).toBeGreaterThan(1.5);
  });

  it("gives no ratio on too few rated sessions rather than guessing", () => {
    expect(acuteChronicRatio(base({ sessions: rated([1, 3, 8]) }), NOW)).toBeNull();
  });

  it("ignores sessions the child missed or that were not rated", () => {
    const s = [...rated([1, 3, 8, 10]), { date: ago(2), attended: false, rpe: 9 }, { date: ago(4), attended: true, rpe: null }];
    expect(acuteChronicRatio(base({ sessions: s }), NOW)).toBe(acuteChronicRatio(base({ sessions: rated([1, 3, 8, 10]) }), NOW));
  });

  it("leaves out anything older than the 28-day window", () => {
    const usual = rated([1, 3, 8, 10, 15, 17, 22, 24]);
    const withOld = [...usual, ...rated([40, 45, 50], 10)];
    expect(acuteChronicRatio(base({ sessions: withOld }), NOW)).toBe(acuteChronicRatio(base({ sessions: usual }), NOW));
  });

  it("counts a match played as load and a match not played as none", () => {
    const withMatch = acuteChronicRatio(base({ sessions: rated([8, 10, 15, 17]), matches: [{ date: ago(1), played: true }] }), NOW)!;
    const benched = acuteChronicRatio(base({ sessions: rated([8, 10, 15, 17]), matches: [{ date: ago(1), played: false }] }), NOW)!;
    expect(withMatch).toBeGreaterThan(benched);
  });
});

describe("ratingChange", () => {
  const r = (vals: number[]) => vals.map((rating, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, rating }));
  it("compares the latest three with the three before", () => {
    expect(ratingChange(r([4, 4, 4, 3, 3, 3]))).toBe(-1);
  });
  it("needs six ratings", () => {
    expect(ratingChange(r([4, 4, 4, 3, 3]))).toBeNull();
  });
  it("does not depend on arrival order", () => {
    expect(ratingChange([...r([4, 4, 4, 3, 3, 3])].reverse())).toBe(-1);
  });
});

describe("readiness", () => {
  it("is steady with nothing wrong", () => {
    const out = readiness(base({ sessions: rated([1, 3, 8, 10, 15, 17, 22, 24]) }), NOW);
    expect(out).toMatchObject({ level: "steady", flags: [], needsEffortRatings: false });
  });

  it("watches on a load spike and explains it in words", () => {
    const s = [...rated([1, 3], 9), ...rated([8, 10, 15, 17, 22, 24], 4)];
    const out = readiness(base({ sessions: s }), NOW);
    expect(out.level).toBe("watch");
    expect(out.flags).toEqual(["load-spike"]);
    expect(out.reasons[0]).toMatch(/usual/);
  });

  it("uses the academy's 75% welfare line for attendance", () => {
    expect(readiness(base({ attendancePct: 0.74 }), NOW).flags).toEqual(["attendance"]);
    expect(readiness(base({ attendancePct: 0.75 }), NOW).flags).toEqual([]);
  });

  it("asks for a check-in when two things are off", () => {
    const ratings = [4, 4, 4, 3, 3, 2].map((rating, i) => ({ date: `2026-09-0${i + 1}`, rating }));
    const out = readiness(base({ attendancePct: 0.5, ratings }), NOW);
    expect(out.level).toBe("check-in");
    expect(out.flags).toEqual(["attendance", "ratings"]);
  });

  it("says effort ratings are missing when the child trains but nothing is rated", () => {
    const s = [{ date: ago(1), attended: true, rpe: null }];
    expect(readiness(base({ sessions: s }), NOW).needsEffortRatings).toBe(true);
  });
});

describe("matchMinutesFor", () => {
  it("scales with age group and falls back", () => {
    expect(matchMinutesFor("U11")).toBe(50);
    expect(matchMinutesFor("u15")).toBe(70);
    expect(matchMinutesFor(null)).toBe(60);
  });
});
