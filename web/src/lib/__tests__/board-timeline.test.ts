import {
  clampStepDuration, durationChoices, formatSeconds, stepDurationMs, stepIndexAt, stepStartTimes,
  MIN_STEP_MS, MAX_STEP_MS, STEP_DURATION_CHOICES_MS,
} from "@/lib/board-timeline";
import { interpolateFrames, totalDurationMs, DEFAULT_FRAME_DURATION_MS, type Frame } from "@/lib/board-model";

const step = (id: string, x: number, durationMs?: number): Frame => ({
  id, tokens: [{ id: "a", x, y: 0 }], shapes: [], durationMs, ease: "linear",
});

// Start at 0, then a 0.5s step to 10, then a 4s step to 90.
const move: Frame[] = [step("s1", 0), step("s2", 10, 500), step("s3", 90, 4000)];

describe("stepDurationMs", () => {
  it("falls back to the old default so old plays keep their speed", () => {
    expect(stepDurationMs({})).toBe(DEFAULT_FRAME_DURATION_MS);
    expect(stepDurationMs({ durationMs: 750 })).toBe(750);
  });
});

describe("clampStepDuration", () => {
  it("keeps a picked duration between 0.5s and 4s", () => {
    expect(clampStepDuration(100)).toBe(MIN_STEP_MS);
    expect(clampStepDuration(9000)).toBe(MAX_STEP_MS);
    expect(clampStepDuration(1499.6)).toBe(1500);
    expect(clampStepDuration(Number.NaN)).toBe(DEFAULT_FRAME_DURATION_MS);
  });
});

describe("stepStartTimes", () => {
  it("adds up each step's own duration", () => {
    expect(stepStartTimes(move)).toEqual([0, 500, 4500]);
  });
  it("uses the default for steps without one", () => {
    expect(stepStartTimes([step("a", 0), step("b", 1), step("c", 2)])).toEqual([0, 1100, 2200]);
  });
  it("ends where totalDurationMs says the move ends", () => {
    expect(stepStartTimes(move).at(-1)).toBe(totalDurationMs(move));
  });
  it("is empty for no steps", () => {
    expect(stepStartTimes([])).toEqual([]);
  });
});

describe("stepIndexAt", () => {
  it("is the last step reached", () => {
    expect(stepIndexAt(move, 0)).toBe(0);
    expect(stepIndexAt(move, 499)).toBe(0);
    expect(stepIndexAt(move, 500)).toBe(1);
    expect(stepIndexAt(move, 4499)).toBe(1);
    expect(stepIndexAt(move, 4500)).toBe(2);
    expect(stepIndexAt(move, 99999)).toBe(2);
  });
  it("is -1 with no steps", () => {
    expect(stepIndexAt([], 10)).toBe(-1);
  });
});

describe("scrubbing respects each step's duration", () => {
  const base = move[0].tokens;
  const xAt = (ms: number) => interpolateFrames(base, move, ms).tokens[0].x;

  it("lands exactly on each step at its start time", () => {
    stepStartTimes(move).forEach((t, i) => expect(xAt(t)).toBeCloseTo(move[i].tokens[0].x));
  });
  it("moves smoothly inside a short step", () => {
    expect(xAt(250)).toBeCloseTo(5);
  });
  it("moves smoothly inside a long step", () => {
    expect(xAt(500 + 2000)).toBeCloseTo(50);
    expect(xAt(500 + 1000)).toBeCloseTo(30);
  });
  it("a longer duration slows the same step down", () => {
    const slow = move.map((f, i) => (i === 1 ? { ...f, durationMs: 1000 } : f));
    expect(interpolateFrames(base, slow, 250).tokens[0].x).toBeCloseTo(2.5);
  });
});

describe("durationChoices", () => {
  it("offers the standard list when the step is on it", () => {
    expect(durationChoices(1000)).toEqual([...STEP_DURATION_CHOICES_MS]);
  });
  it("adds an old play's off-list value in order", () => {
    const c = durationChoices(1100);
    expect(c).toContain(1100);
    expect(c.indexOf(1100)).toBe(c.indexOf(1000) + 1);
    expect(c).toHaveLength(STEP_DURATION_CHOICES_MS.length + 1);
  });
  it("stays within 0.5s–4s", () => {
    expect(Math.min(...STEP_DURATION_CHOICES_MS)).toBe(500);
    expect(Math.max(...STEP_DURATION_CHOICES_MS)).toBe(4000);
  });
});

describe("formatSeconds", () => {
  it("reads as short seconds", () => {
    expect(formatSeconds(500)).toBe("0.5s");
    expect(formatSeconds(1100)).toBe("1.1s");
    expect(formatSeconds(4000)).toBe("4s");
    expect(formatSeconds(0)).toBe("0s");
  });
});
