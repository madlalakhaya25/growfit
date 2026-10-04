import {
  ageNumber,
  applyChange,
  buildRotation,
  changePoints,
  chooseLineup,
  clockSeconds,
  closeAll,
  defaultFormat,
  diffLineups,
  formatClock,
  splitHalf,
  stintSeconds,
  suggestChange,
  toMinutes,
  type RotationInput,
  type RotationPlan,
} from "../playing-time";

const squad = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const spread = (plan: RotationPlan, ids: string[]) => {
  const mins = ids.map((id) => plan.minutes[id]);
  return Math.max(...mins) - Math.min(...mins);
};
const base: RotationInput = { playerIds: squad(12), onPitch: 9, halves: 2, halfMinutes: 25, intervalMinutes: 8 };

describe("defaultFormat", () => {
  it("uses the age group's usual match", () => {
    expect(defaultFormat("U11")).toEqual({ halves: 2, halfMinutes: 25, onPitch: 9 });
    expect(defaultFormat("U13")).toEqual({ halves: 2, halfMinutes: 30, onPitch: 11 });
    expect(defaultFormat("u15")).toEqual({ halves: 2, halfMinutes: 35, onPitch: 11 });
    expect(defaultFormat("U9").onPitch).toBe(7);
  });
  it("falls back to the U13 match for anything unrecognised", () => {
    expect(defaultFormat(null)).toEqual(defaultFormat("U13"));
    expect(defaultFormat("Seniors")).toEqual(defaultFormat("U13"));
    expect(ageNumber("Open")).toBeNull();
  });
});

describe("splitHalf", () => {
  it("never makes a stretch longer than the interval, and adds up to the half", () => {
    for (const half of [20, 25, 30, 35, 40]) {
      for (const interval of [6, 8, 10]) {
        const parts = splitHalf(half, interval);
        expect(parts.reduce((s, p) => s + p, 0)).toBe(half);
        expect(Math.max(...parts)).toBeLessThanOrEqual(interval);
        expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      }
    }
  });
  it("splits 25 minutes at 8 into 7, 6, 6, 6", () => {
    expect(splitHalf(25, 8)).toEqual([7, 6, 6, 6]);
  });
});

describe("buildRotation", () => {
  it("keeps every player within one interval of everyone else", () => {
    for (const n of [9, 10, 11, 12, 13, 14, 15, 16]) {
      for (const interval of [6, 8, 10]) {
        for (const [onPitch, halfMinutes] of [[7, 25], [9, 25], [11, 30], [11, 35]]) {
          const plan = buildRotation({ playerIds: squad(n), onPitch, halves: 2, halfMinutes, intervalMinutes: interval });
          expect(spread(plan, squad(n))).toBeLessThanOrEqual(interval);
        }
      }
    }
  });

  it("works for odd numbers of players", () => {
    const plan = buildRotation({ ...base, playerIds: squad(11), onPitch: 7 });
    expect(spread(plan, squad(11))).toBeLessThanOrEqual(8);
    const total = Object.values(plan.minutes).reduce((s, m) => s + m, 0);
    expect(total).toBe(7 * plan.totalMinutes);
    for (const seg of plan.segments) expect(seg.lineup).toHaveLength(7);
  });

  it("gives everyone the whole match when there is no bench", () => {
    const plan = buildRotation({ ...base, playerIds: squad(8), onPitch: 9 });
    expect(new Set(Object.values(plan.minutes))).toEqual(new Set([50]));
    expect(plan.segments.every((s) => s.off.length === 0 && s.on.length === 0)).toBe(true);
  });

  it("starts with the first players in the coach's order", () => {
    const plan = buildRotation(base);
    expect(plan.segments[0].lineup).toEqual(squad(9));
    expect(plan.segments[0].off).toEqual([]);
  });

  it("plays a fixed keeper every minute and rotates everyone else fairly", () => {
    const plan = buildRotation({ ...base, keeperId: "p12" });
    expect(plan.keeperId).toBe("p12");
    expect(plan.minutes.p12).toBe(plan.totalMinutes);
    for (const seg of plan.segments) {
      expect(seg.lineup[0]).toBe("p12");
      expect(seg.lineup).toHaveLength(9);
      expect(seg.off).not.toContain("p12");
    }
    expect(spread(plan, squad(11))).toBeLessThanOrEqual(8);
  });

  it("ignores a keeper who is not in the squad", () => {
    const plan = buildRotation({ ...base, keeperId: "stranger" });
    expect(plan.keeperId).toBeNull();
    expect(spread(plan, squad(12))).toBeLessThanOrEqual(8);
  });

  it("never subs a player on and off in the same change, and swaps like for like", () => {
    const plan = buildRotation({ ...base, playerIds: squad(13), onPitch: 7, keeperId: "p1" });
    for (const seg of plan.segments) {
      expect(seg.off.filter((id) => seg.on.includes(id))).toEqual([]);
      expect(seg.off).toHaveLength(seg.on.length);
    }
    for (let i = 1; i < plan.segments.length; i++) {
      const prev = new Set(plan.segments[i - 1].lineup);
      for (const id of plan.segments[i].off) expect(prev.has(id)).toBe(true);
      for (const id of plan.segments[i].on) expect(prev.has(id)).toBe(false);
    }
  });

  it("counts the planned minutes from the line-ups", () => {
    const plan = buildRotation(base);
    const counted: Record<string, number> = {};
    for (const s of plan.segments) for (const id of s.lineup) counted[id] = (counted[id] ?? 0) + (s.end - s.start);
    for (const id of squad(12)) expect(plan.minutes[id]).toBe(counted[id] ?? 0);
  });

  it("lists change points after the first stretch, in seconds into the half", () => {
    const plan = buildRotation(base);
    const points = changePoints(plan);
    expect(points[0]).toEqual({ half: 1, atSec: 7 * 60, segmentIndex: 1 });
    expect(points.find((p) => p.half === 2)).toEqual({ half: 2, atSec: 0, segmentIndex: 4 });
  });
});

describe("chooseLineup", () => {
  it("prefers the fewest minutes, then whoever is already on", () => {
    const mins = { a: 10, b: 5, c: 5, d: 0 };
    expect(chooseLineup(["a", "b", "c", "d"], mins, ["c"], 2)).toEqual(["c", "d"]);
    expect(chooseLineup(["a", "b", "c", "d"], mins, [], 2)).toEqual(["b", "d"]);
  });
  it("diffLineups returns who comes off and who goes on", () => {
    expect(diffLineups(["a", "b", "c"], ["a", "d", "c"])).toEqual({ off: ["b"], on: ["d"] });
  });
});

describe("live helpers", () => {
  it("reads the clock with and without a running spell", () => {
    expect(clockSeconds({ baseSec: 90, runningSince: null }, 999_999)).toBe(90);
    expect(clockSeconds({ baseSec: 90, runningSince: 1_000 }, 31_000)).toBe(120);
  });

  it("counts spells on the pitch, open ones up to now", () => {
    expect(stintSeconds([[0, 300], [600, null]], 900)).toBe(600);
    expect(stintSeconds(undefined, 900)).toBe(0);
    expect(toMinutes(89)).toBe(1);
    expect(formatClock(134)).toBe("2:14");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("applies a change without double-counting anyone", () => {
    const start = { a: [[0, null]], b: [[0, null]] } as Record<string, [number, number | null][]>;
    const r = applyChange(start, ["a", "b"], { off: ["a", "c"], on: ["c", "b", "d"] }, 120);
    expect(r.onPitch).toEqual(["b", "d"]);
    expect(r.stints.a).toEqual([[0, 120]]);
    expect(r.stints.b).toEqual([[0, null]]);
    expect(r.stints.d).toEqual([[120, null]]);
    expect(r.stints.c).toBeUndefined();
    expect(start.a).toEqual([[0, null]]);
    expect(closeAll(r.stints, 300).d).toEqual([[120, 300]]);
  });

  it("follows the plan while the coach sticks to it", () => {
    const plan = buildRotation(base);
    const s = suggestChange({ plan, segmentIndex: 1, onPitch: plan.segments[0].lineup, liveSeconds: {}, squad: squad(12) });
    expect(s).toEqual({ off: plan.segments[1].off, on: plan.segments[1].on });
  });

  it("re-balances from live minutes once the coach has gone off-plan", () => {
    const plan = buildRotation({ ...base, playerIds: squad(10), onPitch: 9, keeperId: "p1" });
    const onPitch = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p10"];
    const liveSeconds = { p2: 400, p3: 400, p4: 400, p5: 400, p6: 400, p7: 400, p8: 400, p9: 0, p10: 300 };
    const s = suggestChange({ plan, segmentIndex: 1, onPitch, liveSeconds, squad: squad(10) });
    expect(s.on).toEqual(["p9"]);
    expect(s.off).toHaveLength(1);
    expect(s.off).not.toContain("p1");
    expect(s.off).not.toContain("p10");
  });
});
