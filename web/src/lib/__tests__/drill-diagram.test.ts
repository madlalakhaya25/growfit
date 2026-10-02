import { describeDiagram, validateDiagram, MAX_DIAGRAM_TOKENS } from "../drill-diagram";

const T = (role: string, x: number, y: number) => ({ role, x, y });

const rondo = {
  pitch: "grid-small",
  tokens: [T("team", 10, 10), T("team", 50, 10), T("team", 50, 50), T("team", 10, 50), T("opponent", 28, 30), T("opponent", 40, 30), T("ball", 14, 10)],
  equipment: [{ kind: "cone", x: 6, y: 6 }, { kind: "cone", x: 54, y: 6 }],
  moves: [{ kind: "pass", from: 0, toToken: 1 }, { kind: "pass", from: 1, toToken: 2 }],
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("validateDiagram", () => {
  it("turns a model rondo into board tokens, shapes and equipment", () => {
    const d = validateDiagram(rondo)!;
    expect(d.pitchId).toBe("grid-small");
    expect(d.tokens).toHaveLength(7);
    expect(d.tokens.filter((t) => t.kind === "opponent")).toHaveLength(2);
    expect(d.tokens.filter((t) => t.kind === "ball")).toHaveLength(1);
    expect(d.objects.map((o) => o.kind)).toEqual(["cone", "cone"]);
    expect(d.shapes.map((s) => s.kind)).toEqual(["pass", "pass"]);
  });

  it("numbers our players and colours a keeper differently", () => {
    const d = validateDiagram({ pitch: "half", tokens: [T("keeper", 50, 8), T("team", 40, 40), T("team", 60, 40)] })!;
    expect(d.tokens.map((t) => t.label)).toEqual(["1", "2", "3"]);
    expect(d.tokens[0].group).toBe("Goalkeeper");
    expect(d.tokens[1].group).toBe("Midfielder");
  });

  it("pulls a player who is off the pitch back on", () => {
    const d = validateDiagram({ pitch: "half", tokens: [T("team", 140, -20), T("team", 50, 40)] })!;
    expect(d.tokens[0].x).toBeLessThanOrEqual(100 - 4.2);
    expect(d.tokens[0].y).toBeGreaterThanOrEqual(4.2);
  });

  it("clamps equipment, move ends and zone points onto the pitch", () => {
    const d = validateDiagram({
      pitch: "grid-small",
      tokens: [T("team", 10, 10), T("team", 50, 50)],
      equipment: [{ kind: "cone", x: -5, y: 999 }],
      moves: [{ kind: "run", from: 0, x: 500, y: 500 }],
      zones: [{ points: [{ x: -1, y: -1 }, { x: 99, y: 0 }, { x: 99, y: 99 }] }],
    })!;
    expect(d.objects[0]).toMatchObject({ x: 2, y: 58 });
    expect(d.shapes.find((s) => s.kind === "run")!.pts[1]).toEqual({ x: 58, y: 58 });
    expect(d.shapes.find((s) => s.kind === "zone")!.pts.every((p) => p.x >= 2 && p.x <= 58 && p.y >= 2 && p.y <= 58)).toBe(true);
  });

  it("pushes overlapping players apart, and arrows follow the moved players", () => {
    const d = validateDiagram({
      pitch: "grid-large",
      tokens: [T("team", 30, 40), T("team", 31, 41), T("opponent", 30, 40)],
      moves: [{ kind: "pass", from: 0, toToken: 1 }],
    })!;
    const people = d.tokens;
    for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) expect(dist(people[i], people[j])).toBeGreaterThan(7);
    const pass = d.shapes[0];
    expect(pass.pts[0]).toEqual({ x: d.tokens[0].x, y: d.tokens[0].y });
    expect(pass.pts[1]).toEqual({ x: d.tokens[1].x, y: d.tokens[1].y });
  });

  it("gives up on a layout that would need players moved far to make room", () => {
    const tokens = Array.from({ length: 20 }, (_, i) => T(i % 2 ? "team" : "opponent", 30, 30));
    expect(validateDiagram({ pitch: "grid-small", tokens })).toBeNull();
  });

  it("tolerates a small pile-up but not five players on one spot", () => {
    const pile = (n: number) => ({ pitch: "full", tokens: Array.from({ length: n }, (_, i) => T(i % 2 ? "team" : "opponent", 50, 75)) });
    expect(validateDiagram(pile(4))).not.toBeNull();
    expect(validateDiagram(pile(5))).toBeNull();
  });

  it("keeps a ball beside its player rather than pushing it away", () => {
    const d = validateDiagram({ pitch: "grid-small", tokens: [T("team", 20, 20), T("team", 40, 40), T("ball", 23, 20)] })!;
    expect(dist(d.tokens[0], d.tokens[2])).toBeLessThan(5);
  });

  it("rejects what is not a drawable drill", () => {
    expect(validateDiagram(null)).toBeNull();
    expect(validateDiagram("a pitch")).toBeNull();
    expect(validateDiagram([])).toBeNull();
    expect(validateDiagram({ pitch: "moon", tokens: rondo.tokens })).toBeNull();
    expect(validateDiagram({ pitch: "third", tokens: rondo.tokens })).toBeNull();
    expect(validateDiagram({ pitch: "half" })).toBeNull();
    expect(validateDiagram({ pitch: "half", tokens: [T("team", 50, 50)] })).toBeNull();
    expect(validateDiagram({ pitch: "half", tokens: [T("ball", 40, 40), T("ball", 60, 40)] })).toBeNull();
  });

  it("drops unreadable tokens and unknown kit, and fixes move indexes to match", () => {
    const d = validateDiagram({
      pitch: "half",
      tokens: [T("team", 30, 40), { role: "wizard", x: 1, y: 1 }, T("team", 70, 40), { role: "team", x: "far", y: 1 }],
      equipment: [{ kind: "jetpack", x: 10, y: 10 }, { kind: "cone", x: 10, y: 10 }],
      // index 2 in the model's list is the second readable token
      moves: [{ kind: "pass", from: 0, toToken: 2 }, { kind: "pass", from: 0, toToken: 1 }],
    })!;
    expect(d.tokens).toHaveLength(2);
    expect(d.objects).toHaveLength(1);
    expect(d.shapes).toHaveLength(1);
    expect(d.shapes[0].pts[1]).toEqual({ x: d.tokens[1].x, y: d.tokens[1].y });
  });

  it("drops moves that go nowhere, start on nothing, or use a non-arrow kind", () => {
    const d = validateDiagram({
      pitch: "half",
      tokens: [T("team", 30, 40), T("team", 70, 40)],
      moves: [
        { kind: "pass", from: 0, toToken: 0 },
        { kind: "run", from: 9, x: 50, y: 50 },
        { kind: "spotlight", from: 0, x: 50, y: 50 },
        { kind: "run", from: 0 },
        { kind: "run", from: 0, x: 31, y: 40 },
        { kind: "run", from: 0, x: 50, y: 20, curve: 9 },
      ],
    })!;
    expect(d.shapes).toHaveLength(1);
    expect(d.shapes[0].curve).toBe(0.4);
  });

  it("caps the number of tokens it will read", () => {
    const tokens = Array.from({ length: 60 }, (_, i) => T("team", 5 + (i % 10) * 10, 5 + Math.floor(i / 10) * 20));
    const d = validateDiagram({ pitch: "full", tokens });
    expect(d === null || d.tokens.length <= MAX_DIAGRAM_TOKENS).toBe(true);
  });

  it("draws zones under the arrows, hatched only when asked", () => {
    const d = validateDiagram({
      ...rondo,
      zones: [{ points: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 40 }], hatch: true }, { points: [{ x: 1, y: 1 }] }],
    })!;
    expect(d.shapes[0]).toMatchObject({ kind: "zone", fill: "hatch" });
    expect(d.shapes.filter((s) => s.kind === "zone")).toHaveLength(1);
  });

  it("is deterministic", () => {
    expect(validateDiagram(rondo)).toEqual(validateDiagram(JSON.parse(JSON.stringify(rondo))));
  });
});

describe("describeDiagram", () => {
  it("reads the picture out as a sentence", () => {
    expect(describeDiagram(validateDiagram(rondo)!)).toBe("Drill diagram: 4 players, 2 opponents, 2 pieces of kit, 2 movements marked.");
  });
  it("counts keepers separately", () => {
    const d = validateDiagram({ pitch: "half", tokens: [T("keeper", 50, 8), T("team", 40, 40)] })!;
    expect(describeDiagram(d)).toBe("Drill diagram: 1 player, 1 goalkeeper.");
  });
});
