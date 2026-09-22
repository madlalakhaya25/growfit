import {
  interpolateFrames, totalDurationMs, DEFAULT_FRAME_DURATION_MS,
  shapeColor, shapeWidth, dribblePath, polyPath, getPitch, PITCHES, resolveSpotlightCenter,
  groupOf, assignToSlots, compress,
  type Frame, type Shape, type BoardPlayer,
} from "@/lib/board-model";
import type { Formation } from "@/lib/formations";

const tok = (id: string, x: number, y: number) => ({ id, x, y });

describe("interpolateFrames", () => {
  const frames: Frame[] = [
    { id: "f0", tokens: [tok("a", 0, 0)], shapes: [] },
    { id: "f1", tokens: [tok("a", 100, 0)], shapes: [], durationMs: 1000, ease: "linear" },
  ];

  it("returns the start position at elapsed 0", () => {
    const { tokens } = interpolateFrames(frames[0].tokens, frames, 0);
    expect(tokens[0].x).toBeCloseTo(0);
  });

  it("returns the end position once elapsed reaches the segment duration", () => {
    const { tokens } = interpolateFrames(frames[0].tokens, frames, 1000);
    expect(tokens[0].x).toBeCloseTo(100);
  });

  it("interpolates linearly at the midpoint when ease is linear", () => {
    const { tokens } = interpolateFrames(frames[0].tokens, frames, 500);
    expect(tokens[0].x).toBeCloseTo(50);
  });

  it("clamps elapsed beyond the total duration to the final frame", () => {
    const { tokens } = interpolateFrames(frames[0].tokens, frames, 5000);
    expect(tokens[0].x).toBeCloseTo(100);
  });

  it("falls back to the default duration and ease when a step doesn't say", () => {
    // Old saved plays (before per-step timing existed) have neither field —
    // this must behave exactly like the previous hardcoded SEG = 1100 loop.
    const legacy: Frame[] = [
      { id: "f0", tokens: [tok("a", 0, 0)], shapes: [] },
      { id: "f1", tokens: [tok("a", 100, 0)], shapes: [] },
    ];
    expect(totalDurationMs(legacy)).toBe(DEFAULT_FRAME_DURATION_MS);
    const { tokens } = interpolateFrames(legacy[0].tokens, legacy, DEFAULT_FRAME_DURATION_MS);
    expect(tokens[0].x).toBeCloseTo(100);
  });

  it("carries a token with no entry in either frame through unchanged", () => {
    const withExtra = [tok("a", 0, 0), tok("b", 5, 5)];
    const { tokens } = interpolateFrames(withExtra, frames, 500);
    const b = tokens.find((t) => t.id === "b")!;
    expect(b.x).toBe(5);
    expect(b.y).toBe(5);
  });

  it("returns the base tokens unchanged when there are fewer than 2 frames", () => {
    const single: Frame[] = [{ id: "f0", tokens: [tok("a", 3, 4)], shapes: [] }];
    const { tokens } = interpolateFrames(single[0].tokens, single, 999);
    expect(tokens[0].x).toBe(3);
    expect(tokens[0].y).toBe(4);
  });

  it("steps through a multi-segment sequence using each segment's own duration", () => {
    const multi: Frame[] = [
      { id: "f0", tokens: [tok("a", 0, 0)], shapes: [] },
      { id: "f1", tokens: [tok("a", 10, 0)], shapes: [], durationMs: 200, ease: "linear" },
      { id: "f2", tokens: [tok("a", 10, 10)], shapes: [], durationMs: 800, ease: "linear" },
    ];
    expect(totalDurationMs(multi)).toBe(1000);
    // Still inside the first (200ms) segment.
    expect(interpolateFrames(multi[0].tokens, multi, 100).tokens[0].x).toBeCloseTo(5);
    // Into the second (800ms) segment.
    const mid = interpolateFrames(multi[0].tokens, multi, 200 + 400);
    expect(mid.tokens[0].x).toBeCloseTo(10);
    expect(mid.tokens[0].y).toBeCloseTo(5);
  });
});

describe("shapeColor / shapeWidth", () => {
  it("falls back to the kind's default colour and width when unset", () => {
    const sh: Pick<Shape, "kind" | "color"> = { kind: "run" };
    expect(shapeColor(sh)).toBe("#fde047");
    expect(shapeWidth({})).toBe(1.2);
  });

  it("prefers a shape's own colour and width when set", () => {
    expect(shapeColor({ kind: "run", color: "#ff0000" })).toBe("#ff0000");
    expect(shapeWidth({ width: 3 })).toBe(3);
  });
});

describe("dribblePath / polyPath", () => {
  it("starts a dribble path at the first point", () => {
    expect(dribblePath(0, 0, 10, 0)).toMatch(/^M0,0/);
  });

  it("returns an empty string for no points", () => {
    expect(polyPath([])).toBe("");
  });

  it("builds a polyline through every point in order", () => {
    const d = polyPath([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]);
    expect(d.startsWith("M0.00,0.00")).toBe(true);
    expect(d).toContain("L1.00,1.00");
    expect(d).toContain("L2.00,0.00");
  });
});

describe("getPitch", () => {
  it("returns the full pitch as the default for a missing/unknown id", () => {
    expect(getPitch(undefined).id).toBe("full");
    expect(getPitch("not-a-real-pitch").id).toBe("full");
  });

  it("returns the requested pitch when it exists", () => {
    expect(getPitch("half").id).toBe("half");
  });

  it("every pitch has at least one marking and positive dimensions", () => {
    for (const p of PITCHES) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
      expect(p.markings.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveSpotlightCenter", () => {
  const shape: Pick<Shape, "playerId" | "pts"> = { playerId: "p1", pts: [{ x: 1, y: 1 }] };

  it("follows the token currently bound to the shape's playerId", () => {
    const tokens = [{ playerId: "p1", x: 50, y: 60 }];
    expect(resolveSpotlightCenter(shape, tokens)).toEqual({ x: 50, y: 60 });
  });

  it("still finds the player after a substitution changed their token id", () => {
    // Substitution assigns a brand-new token id but keeps playerId — that's
    // the whole point of resolving by playerId instead of a stored point.
    const tokens = [{ playerId: "p1", x: 30, y: 40 }];
    expect(resolveSpotlightCenter(shape, tokens)).toEqual({ x: 30, y: 40 });
  });

  it("falls back to the shape's stored point when the player isn't on the board", () => {
    expect(resolveSpotlightCenter(shape, [])).toEqual({ x: 1, y: 1 });
  });

  it("falls back to the stored point when the shape has no playerId at all", () => {
    const noPlayer: Pick<Shape, "playerId" | "pts"> = { pts: [{ x: 9, y: 9 }] };
    expect(resolveSpotlightCenter(noPlayer, [{ playerId: "p1", x: 50, y: 60 }])).toEqual({ x: 9, y: 9 });
  });
});

describe("groupOf", () => {
  it("maps a known position value to its group", () => {
    expect(groupOf("cb")).toBe("Defender");
    expect(groupOf("st")).toBe("Forward");
    expect(groupOf("gk")).toBe("Goalkeeper");
  });

  it("falls back to Midfielder for a null position", () => {
    expect(groupOf(null)).toBe("Midfielder");
  });

  it("falls back to Midfielder for an unrecognised position", () => {
    expect(groupOf("not-a-real-position")).toBe("Midfielder");
  });
});

describe("assignToSlots", () => {
  const formation: Formation = {
    id: "test-3",
    label: "Test",
    size: 5,
    format: "test",
    slots: [
      { x: 50, y: 142, role: "gk" },
      { x: 30, y: 112, role: "cb" },
      { x: 50, y: 50, role: "st" },
    ],
  };
  const player = (id: string, full_name: string, position: string | null): BoardPlayer => ({ id, full_name, position });

  it("runs the exact role, then group, then leftover cascade in order", () => {
    // p1: no exact "cb" match but same Defender group via "rb".
    // p2: exact "st" match.
    // p3: no position at all — only fillable as a leftover.
    const p1 = player("1", "P1", "rb");
    const p2 = player("2", "P2", "st");
    const p3 = player("3", "P3", null);
    const roster = [p1, p2, p3];

    const out = assignToSlots(formation, roster);

    expect(out[2]).toBe(p2); // exact role match: st -> st
    expect(out[1]).toBe(p1); // group match: rb is Defender, slot role cb is Defender
    expect(out[0]).toBe(p3); // leftover fill, in remaining list order
  });

  it("prefers an exact role match over a same-group player earlier in the list", () => {
    const groupOnly = player("1", "GroupOnly", "lb"); // Defender, but not exact "cb"
    const exact = player("2", "Exact", "cb");
    const out = assignToSlots(formation, [groupOnly, exact]);
    expect(out[1]).toBe(exact);
  });

  it("leaves a slot undefined when the roster runs out", () => {
    const out = assignToSlots(formation, [player("1", "Solo", "gk")]);
    expect(out[0]?.id).toBe("1");
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBeUndefined();
  });
});

describe("compress", () => {
  it("keeps the home team in the bottom half, deepest slot nearest the home goal", () => {
    expect(compress({ x: 50, y: 142 }, "home")).toEqual({ x: 50, y: 146 });
    expect(compress({ x: 50, y: 38 }, "home")).toEqual({ x: 50, y: 78 });
  });

  it("mirrors the away team into the top half, x flipped across the pitch", () => {
    expect(compress({ x: 50, y: 142 }, "away")).toEqual({ x: 50, y: 4 });
    expect(compress({ x: 30, y: 38 }, "away")).toEqual({ x: 70, y: 72 });
  });
});
