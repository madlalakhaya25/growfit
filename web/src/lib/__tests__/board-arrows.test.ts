import {
  arrowControl, arrowSpine, arrowPath, wavyPoints, pressMarks, zonePolygon, simplifyPath, dribblePath,
} from "@/lib/board-model";
import { framesFromShapes } from "@/lib/play-motion";

const a = { x: 50, y: 100 }, b = { x: 50, y: 60 }; // travelling up the pitch

describe("arrow geometry", () => {
  it("is straight with no curve", () => {
    expect(arrowControl(a, b)).toBeNull();
    expect(arrowSpine(a, b)).toEqual([a, b]);
    expect(arrowPath(a, b)).toBe("M50,100 L50,60");
  });

  it("bends left of travel for a positive curve, right for a negative one", () => {
    expect(arrowControl(a, b, 0.25)!.x).toBeLessThan(50);
    expect(arrowControl(a, b, -0.25)!.x).toBeGreaterThan(50);
    expect(arrowPath(a, b, 0.25)).toMatch(/^M50,100 Q[\d.]+,80\.00 50,60$/);
    const spine = arrowSpine(a, b, 0.25);
    expect(spine[0]).toEqual(a);
    expect(spine[spine.length - 1]).toEqual(b);
    expect(Math.min(...spine.map((p) => p.x))).toBeLessThan(50);
  });

  it("waves a dribble along the spine and still ends on target", () => {
    const pts = wavyPoints(arrowSpine(a, b, 0.2));
    expect(pts[0]).toEqual(a);
    expect(pts[pts.length - 1]).toEqual(b);
    expect(pts.length).toBeGreaterThan(5);
    // Straight, it matches the original dribble helper point for point.
    expect(dribblePath(50, 100, 50, 60).split(" L").length).toBe(wavyPoints([a, b]).length);
  });

  it("marks a press with ticks along it and a bar across the end", () => {
    const { ticks, bar } = pressMarks([a, b]);
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    // Bar is horizontal across a vertical line, centred on its end.
    expect(bar[0].y).toBeCloseTo(60);
    expect(bar[1].y).toBeCloseTo(60);
    expect((bar[0].x + bar[1].x) / 2).toBeCloseTo(50);
  });
});

describe("zone geometry", () => {
  it("makes a box or an inscribed oval", () => {
    expect(zonePolygon({ x: 10, y: 10 }, { x: 30, y: 20 }, "rect")).toHaveLength(4);
    const oval = zonePolygon({ x: 10, y: 10 }, { x: 30, y: 20 }, "ellipse");
    expect(oval).toHaveLength(36);
    expect(Math.min(...oval.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.max(...oval.map((p) => p.y))).toBeCloseTo(20);
  });

  it("thins a lasso's near-duplicate points", () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: i * 0.2, y: 0 }));
    expect(simplifyPath(pts).length).toBeLessThan(10);
  });
});

describe("new movement kinds in Play", () => {
  const tokens = [
    { id: "p", x: 50, y: 100, kind: "player" as const },
    { id: "ball", x: 50, y: 100, kind: "ball" as const },
  ];
  it("a shot sends the ball, a press moves the presser", () => {
    const shot = framesFromShapes(tokens, [{ id: "s", kind: "shot", pts: [{ x: 50, y: 100 }, { x: 50, y: 5 }] }]);
    expect(shot[1].tokens.find((t) => t.id === "ball")!.y).toBe(5);
    expect(shot[1].tokens.find((t) => t.id === "p")!.y).toBe(100);
    const press = framesFromShapes(tokens, [{ id: "x", kind: "press", pts: [{ x: 50, y: 100 }, { x: 50, y: 80 }] }]);
    expect(press[1].tokens.find((t) => t.id === "p")!.y).toBe(80);
  });
});
