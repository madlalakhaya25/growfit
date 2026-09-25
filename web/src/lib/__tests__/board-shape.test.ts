import {
  convexHull, teamShape, distanceMetres, mirrorPoint, getPitch, PITCHES,
} from "@/lib/board-model";
import { tokenBadge } from "@/components/tactics/token-glyph";

const full = getPitch("full");

describe("convexHull", () => {
  it("drops interior points", () => {
    const hull = convexHull([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 },
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 5, y: 5 });
  });

  it("returns fewer than three points unchanged", () => {
    expect(convexHull([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
  });
});

describe("teamShape", () => {
  const p = (x: number, y: number, group: string) => ({ kind: "player" as const, group, x, y });

  it("measures outfield width and depth, leaving the keeper out", () => {
    const shape = teamShape(
      [p(50, 146, "Goalkeeper"), p(10, 120, "Defender"), p(90, 120, "Defender"), p(50, 80, "Forward")],
      "player",
      full
    )!;
    expect(shape.widthM).toBeCloseTo(80 * full.metresPerUnit);
    expect(shape.depthM).toBeCloseTo(40 * full.metresPerUnit);
    expect(shape.outfield).toHaveLength(3);
  });

  it("links each unit left to right", () => {
    const shape = teamShape(
      [p(90, 120, "Defender"), p(10, 120, "Defender"), p(50, 100, "Midfielder")],
      "player",
      full
    )!;
    expect(shape.units).toEqual([[{ x: 10, y: 120 }, { x: 90, y: 120 }]]);
  });

  it("treats the deepest of a full opponent side as their keeper", () => {
    const opp = Array.from({ length: 11 }, (_, i) => ({ kind: "opponent" as const, group: "Opponent", x: 10 + i * 8, y: i === 0 ? 4 : 40 }));
    const shape = teamShape(opp, "opponent", full)!;
    expect(shape.outfield).toHaveLength(10);
    expect(shape.depthM).toBe(0);
  });

  it("needs at least two outfield players", () => {
    expect(teamShape([p(50, 100, "Defender")], "player", full)).toBeNull();
  });
});

describe("distanceMetres", () => {
  it("converts through the pitch's scale", () => {
    const grid = getPitch("grid-small");
    expect(distanceMetres({ x: 2, y: 2 }, { x: 58, y: 2 }, grid)).toBeCloseTo(20);
  });

  it("every pitch has a positive scale", () => {
    for (const pitch of PITCHES) expect(pitch.metresPerUnit).toBeGreaterThan(0);
  });
});

describe("mirrorPoint", () => {
  it("flips x across the pitch width and keeps other fields", () => {
    expect(mirrorPoint({ x: 20, y: 30, id: "a" }, 100)).toEqual({ x: 80, y: 30, id: "a" });
  });
});

describe("tokenBadge", () => {
  it("keeps slot numbers and takes a name's initial", () => {
    expect(tokenBadge("7")).toBe("7");
    expect(tokenBadge("sipho")).toBe("S");
    expect(tokenBadge("")).toBe("");
  });
});
