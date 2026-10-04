import {
  activePhase, applyShape, phaseGlideFrames, phaseOptions, phaseTourFrames, phasesForSave, phasesFromLayouts, readPhases, shapeOf, switchPhase, PHASE_GLIDE_MS,
  type PhaseShapes,
} from "@/lib/board-phases";
import { interpolateFrames, type Token } from "@/lib/board-model";

const player = (id: string, x: number, y: number): Token => ({ id, label: id, x, y, kind: "player", group: "Midfielder" });
const opp = (id: string, x: number, y: number): Token => ({ id, label: id, x, y, kind: "opponent", group: "Opponent" });
const ball = (x: number, y: number): Token => ({ id: "ball", label: "", x, y, kind: "ball", group: "Ball" });

const board = () => [player("a", 10, 100), player("b", 50, 110), opp("o", 50, 40), ball(50, 75)];

describe("activePhase", () => {
  it("is 'with the ball' for a board saved before phases existed", () => {
    expect(activePhase(undefined)).toBe("with");
  });
  it("is whatever the board says otherwise", () => {
    expect(activePhase({ active: "without" })).toBe("without");
  });
});

describe("shapeOf / applyShape", () => {
  it("keeps our players and the opposition, but not the ball", () => {
    expect(shapeOf(board())).toEqual([{ id: "a", x: 10, y: 100 }, { id: "b", x: 50, y: 110 }, { id: "o", x: 50, y: 40 }]);
  });
  it("moves tokens the shape knows and leaves the rest", () => {
    const out = applyShape(board(), [{ id: "a", x: 20, y: 90 }, { id: "gone", x: 1, y: 1 }]);
    expect(out.find((t) => t.id === "a")).toMatchObject({ x: 20, y: 90, label: "a" });
    expect(out.find((t) => t.id === "b")).toMatchObject({ x: 50, y: 110 });
    expect(out.find((t) => t.id === "o")).toMatchObject({ x: 50, y: 40 });
    expect(out).toHaveLength(4);
  });
});

describe("switchPhase", () => {
  it("opens 'without the ball' as a copy of the current shape the first time", () => {
    const tokens = board();
    const res = switchPhase(tokens, undefined, "without");
    expect(res.tokens).toEqual(tokens);
    expect(res.phases.active).toBe("without");
    expect(res.phases.with).toEqual(shapeOf(tokens));
    expect(res.phases.without).toEqual(shapeOf(tokens));
  });

  it("stores the shape being left and brings the other one back", () => {
    // Open "without", drop deep, flip back: the attacking shape returns.
    const first = switchPhase(board(), undefined, "without");
    const deep = first.tokens.map((t) => (t.kind === "player" ? { ...t, y: t.y + 20 } : t));
    const back = switchPhase(deep, first.phases, "with");
    expect(back.phases.active).toBe("with");
    expect(back.tokens.find((t) => t.id === "a")).toMatchObject({ x: 10, y: 100 });
    expect(back.phases.without).toEqual([{ id: "a", x: 10, y: 120 }, { id: "b", x: 50, y: 130 }, { id: "o", x: 50, y: 40 }]);

    // ...and flipping again restores the deep shape.
    const again = switchPhase(back.tokens, back.phases, "without");
    expect(again.tokens.find((t) => t.id === "b")).toMatchObject({ x: 50, y: 130 });
  });

  it("moves the opposition with us, but never the ball", () => {
    const first = switchPhase(board(), undefined, "without");
    // The coach drags an opponent and the ball while "without" is showing.
    const moved = first.tokens.map((t) => (t.kind === "player" ? t : { ...t, x: t.x + 5 }));
    const back = switchPhase(moved, first.phases, "with");
    // The opponent goes back to where "with" had them; the ball stays put.
    expect(back.tokens.find((t) => t.id === "o")).toMatchObject({ x: 50, y: 40 });
    expect(back.tokens.find((t) => t.id === "ball")).toMatchObject({ x: 55, y: 75 });
    expect(back.phases.without?.map((p) => p.id)).toEqual(["a", "b", "o"]);
    expect(back.phases.without?.find((p) => p.id === "o")).toMatchObject({ x: 55 });
  });

  it("is a no-op on the tokens when the phase is already showing", () => {
    const tokens = board();
    const res = switchPhase(tokens, { active: "with" }, "with");
    expect(res.tokens).toEqual(tokens);
    expect(res.phases).toEqual({ active: "with", with: shapeOf(tokens) });
  });
});

describe("phasesForSave", () => {
  it("leaves a never-flipped board without phases, so it saves as before", () => {
    expect(phasesForSave(board(), undefined)).toBeUndefined();
  });
  it("refreshes the showing phase from the live tokens", () => {
    const tokens = board();
    const saved = phasesForSave(tokens, { active: "without", with: [{ id: "a", x: 1, y: 1 }], without: [] });
    expect(saved).toEqual({ active: "without", with: [{ id: "a", x: 1, y: 1 }], without: shapeOf(tokens) });
  });
});

describe("readPhases", () => {
  it("treats missing or junk data as an old play", () => {
    expect(readPhases(undefined)).toBeUndefined();
    expect(readPhases("with")).toBeUndefined();
    expect(readPhases({ active: "sideways" })).toBeUndefined();
  });
  it("round-trips through JSON", () => {
    const p: PhaseShapes = { active: "without", with: [{ id: "a", x: 1, y: 2 }], without: [{ id: "a", x: 3, y: 4 }] };
    expect(readPhases(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("drops malformed rows but keeps good ones", () => {
    expect(readPhases({ active: "with", with: [{ id: "a", x: 1, y: 2 }, { id: 3 }, null, { id: "b", x: "1", y: 2 }], without: "nope" }))
      .toEqual({ active: "with", with: [{ id: "a", x: 1, y: 2 }] });
  });
});

describe("phaseGlideFrames", () => {
  it("glides through the board's own interpolation from one shape to the other", () => {
    const from = board();
    const to = applyShape(from, [{ id: "a", x: 30, y: 100 }]);
    const frames = phaseGlideFrames(from, to, []);
    expect(frames).toHaveLength(2);
    expect(frames[1].durationMs).toBe(PHASE_GLIDE_MS);
    const mid = interpolateFrames(from, frames, PHASE_GLIDE_MS / 2).tokens.find((t) => t.id === "a")!;
    expect(mid.x).toBeCloseTo(20);
    const end = interpolateFrames(from, frames, PHASE_GLIDE_MS).tokens.find((t) => t.id === "a")!;
    expect(end.x).toBeCloseTo(30);
  });
});

describe("phasesFromLayouts and phaseTourFrames", () => {
  const spot = (x: number, y: number) => ({ x, y });
  const layouts = {
    base: { home: [spot(10, 100)], away: [spot(90, 50)] },
    attack: { home: [spot(10, 70)], away: [spot(90, 20)] },
    defend: { home: [spot(10, 120)], away: [spot(90, 80)] },
  };
  const phases = phasesFromLayouts({ home: ["h1"], away: ["a1"] }, layouts);

  it("stores the formation, then each team's shape for attack and defence", () => {
    expect(phases.active).toBe("base");
    expect(phases.base).toEqual([{ id: "h1", x: 10, y: 100 }, { id: "a1", x: 90, y: 50 }]);
    expect(phases.with).toEqual([{ id: "h1", x: 10, y: 70 }, { id: "a1", x: 90, y: 20 }]);
    expect(phases.without).toEqual([{ id: "h1", x: 10, y: 120 }, { id: "a1", x: 90, y: 80 }]);
  });

  it("offers Formation only when the board has one", () => {
    expect(phaseOptions(undefined).map((p) => p.id)).toEqual(["with", "without"]);
    expect(phaseOptions(phases).map((p) => p.id)).toEqual(["base", "with", "without"]);
  });

  it("tours formation, attack, defence in three frames", () => {
    const tokens = [{ id: "h1", x: 10, y: 100 }, { id: "a1", x: 90, y: 50 }];
    const frames = phaseTourFrames(phases, tokens, []);
    expect(frames).toHaveLength(3);
    expect(frames[1].tokens).toEqual([{ id: "h1", x: 10, y: 70 }, { id: "a1", x: 90, y: 20 }]);
    expect(frames[2].tokens).toEqual([{ id: "h1", x: 10, y: 120 }, { id: "a1", x: 90, y: 80 }]);
    expect(frames[1].durationMs).toBeGreaterThan(0);
  });

  it("round-trips the formation through saved JSON", () => {
    expect(readPhases(JSON.parse(JSON.stringify(phases)))).toEqual(phases);
  });
});
