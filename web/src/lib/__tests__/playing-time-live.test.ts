import { buildRotation } from "../playing-time";
import {
  confirmChange,
  createLiveState,
  endHalf,
  finalMinutes,
  finishMatch,
  halfSeconds,
  liveSeconds,
  nextChange,
  parseLiveState,
  pauseClock,
  skipChange,
  startClock,
  startNextHalf,
  suggestedChange,
  undoChange,
  type LiveConfig,
} from "../playing-time-live";

const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"];
const config: LiveConfig = { playerIds: ids, onPitch: 7, halves: 2, halfMinutes: 25, intervalMinutes: 8, keeperId: "p1" };
const plan = buildRotation(config);
const MIN = 60_000;

describe("live match state", () => {
  it("starts with the plan's first line-up on and the clock stopped", () => {
    const s = createLiveState(config);
    expect(s.onPitch).toEqual(plan.segments[0].lineup);
    expect(halfSeconds(s, 10 * MIN)).toBe(0);
    expect(nextChange(s, plan, 0).segmentIndex).toBeNull();
  });

  it("counts down to the first change and says when it is due", () => {
    const s = startClock(createLiveState(config), 0);
    expect(nextChange(s, plan, 5 * MIN)).toMatchObject({ segmentIndex: 1, secondsUntil: 120, due: false });
    expect(nextChange(s, plan, 7 * MIN).due).toBe(true);
  });

  it("does not count time while paused", () => {
    let s = startClock(createLiveState(config), 0);
    s = pauseClock(s, 2 * MIN);
    expect(halfSeconds(s, 9 * MIN)).toBe(120);
    s = startClock(s, 9 * MIN);
    expect(halfSeconds(s, 10 * MIN)).toBe(180);
    expect(liveSeconds(s, 10 * MIN).p2).toBe(180);
  });

  it("makes the suggested change, moves the countdown on, and can undo it", () => {
    const s0 = startClock(createLiveState(config), 0);
    const change = suggestedChange(s0, plan, 7 * MIN);
    expect(change).toEqual({ off: plan.segments[1].off, on: plan.segments[1].on });
    const s1 = confirmChange(s0, change, plan, 7 * MIN);
    expect(s1.onPitch.sort()).toEqual([...plan.segments[1].lineup].sort());
    expect(nextChange(s1, plan, 7 * MIN)).toMatchObject({ segmentIndex: 2, due: false });
    expect(undoChange(s1).onPitch).toEqual(s0.onPitch);
  });

  it("treats a change made a little early as the planned one, but not one made mid-stretch", () => {
    const s0 = startClock(createLiveState(config), 0);
    const change = { off: ["p2"], on: ["p9"] };
    expect(confirmChange(s0, change, plan, 6 * MIN).nextPoint).toBe(1);
    expect(confirmChange(s0, change, plan, 2 * MIN).nextPoint).toBe(0);
  });

  it("refuses an uneven change", () => {
    const s0 = startClock(createLiveState(config), 0);
    expect(confirmChange(s0, { off: ["p2"], on: [] }, plan, MIN)).toBe(s0);
  });

  it("offers the half-time change at the break and moves to the second half", () => {
    let s = startClock(createLiveState(config), 0);
    for (let i = 0; i < 3; i++) s = skipChange(s, plan);
    s = endHalf(s, 26 * MIN);
    expect(s.phase).toBe("break");
    expect(nextChange(s, plan, 30 * MIN)).toMatchObject({ atHalfTime: true, due: true });
    s = confirmChange(s, suggestedChange(s, plan, 30 * MIN), plan, 30 * MIN);
    expect(nextChange(s, plan, 30 * MIN).due).toBe(false);
    s = startNextHalf(s, 35 * MIN, plan);
    expect(nextChange(s, plan, 35 * MIN)).toMatchObject({ segmentIndex: 5, due: false });
    expect(s.half).toBe(2);
    expect(halfSeconds(s, 36 * MIN)).toBe(60);
  });

  it("closes every spell at the final whistle and rounds minutes", () => {
    let s = startClock(createLiveState(config), 0);
    s = finishMatch(s, 10 * MIN + 20_000);
    expect(s.phase).toBe("done");
    const mins = Object.fromEntries(finalMinutes(s, 99 * MIN).map((m) => [m.playerId, m.minutes]));
    expect(mins.p1).toBe(10);
    expect(mins.p10).toBe(0);
  });

  it("reads back what it stored and rejects anything damaged", () => {
    const s = confirmChange(startClock(createLiveState(config), 0), { off: ["p2"], on: ["p9"] }, plan, 7 * MIN);
    expect(parseLiveState(JSON.stringify(s))).toEqual(s);
    expect(parseLiveState("{not json")).toBeNull();
    expect(parseLiveState(JSON.stringify({ ...s, v: 2 }))).toBeNull();
    expect(parseLiveState(JSON.stringify({ ...s, stints: { p1: [["x", null]] } }))).toBeNull();
    expect(parseLiveState(null)).toBeNull();
  });
});
