import { describeStep, poseAtStep } from "../play-steps";
import type { Frame, Shape } from "../board-model";

const base = [
  { id: "a", label: "Ayo", kind: "player" as const, group: "Midfielder", x: 10, y: 100 },
  { id: "b", label: "Bo", kind: "player" as const, group: "Forward", x: 50, y: 60 },
  { id: "x", label: "Opp", kind: "opponent" as const, group: "Defender", x: 50, y: 30 },
];
const run: Shape = { id: "s1", kind: "run", pts: [{ x: 10, y: 100 }, { x: 10, y: 95 }] };
const pass: Shape = { id: "s2", kind: "pass", pts: [{ x: 10, y: 95 }, { x: 50, y: 60 }] };
const oppRun: Shape = { id: "s3", kind: "run", pts: [{ x: 50, y: 30 }, { x: 50, y: 40 }] };
const frames: Frame[] = [
  { id: "f0", tokens: [{ id: "a", x: 10, y: 100 }, { id: "b", x: 50, y: 60 }, { id: "x", x: 50, y: 30 }], shapes: [] },
  { id: "f1", tokens: [{ id: "a", x: 10, y: 95 }, { id: "b", x: 50, y: 60 }, { id: "x", x: 50, y: 30 }], shapes: [run] },
  { id: "f2", tokens: [{ id: "a", x: 10, y: 95 }, { id: "b", x: 50, y: 60 }, { id: "x", x: 50, y: 40 }], shapes: [run, pass, oppRun] },
];

describe("poseAtStep", () => {
  it("puts every token where that step's frame has it, with that step's arrows", () => {
    const pose = poseAtStep(base, frames, 1);
    expect(pose.tokens.find((t) => t.id === "a")).toMatchObject({ x: 10, y: 95 });
    expect(pose.shapes.map((s) => s.id)).toEqual(["s1"]);
  });
  it("clamps an out-of-range step and keeps a token the frame doesn't mention where it was", () => {
    expect(poseAtStep(base, frames, 99).shapes).toHaveLength(3);
    expect(poseAtStep(base, frames, -3).shapes).toEqual([]);
    const partial = poseAtStep(base, [{ id: "f", tokens: [], shapes: [] }], 0);
    expect(partial.tokens).toEqual(base);
  });
});

describe("describeStep", () => {
  it("is the starting picture at step 0", () => {
    expect(describeStep(base, frames, 0)).toEqual(["Where everyone starts."]);
  });
  it("names the player each new arrow starts on, and nobody from the other side", () => {
    expect(describeStep(base, frames, 1)).toEqual(["Ayo runs."]);
    expect(describeStep(base, frames, 2)).toEqual(["Ayo passes."]);
  });
  it("falls back to a plain line when the only change is not ours", () => {
    const only: Frame[] = [frames[0], { ...frames[1], shapes: [oppRun] }];
    expect(describeStep(base, only, 1)).toEqual(["The ball and the other players move on."]);
  });
});
