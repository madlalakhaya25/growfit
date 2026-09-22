import { framesFromShapes, type MotionToken, type MotionShape } from "@/lib/play-motion";

const player = (id: string, x: number, y: number): MotionToken => ({ id, x, y, kind: "player" });
const ball = (id: string, x: number, y: number): MotionToken => ({ id, x, y, kind: "ball" });
const arrow = (id: string, kind: MotionShape["kind"], from: { x: number; y: number }, to: { x: number; y: number }): MotionShape => ({
  id, kind, pts: [from, to],
});

describe("framesFromShapes", () => {
  it("returns no frames when there are no shapes at all", () => {
    expect(framesFromShapes([player("p1", 10, 10)], [])).toEqual([]);
  });

  it("returns no frames when there are no tokens", () => {
    expect(framesFromShapes([], [arrow("a1", "run", { x: 0, y: 0 }, { x: 50, y: 50 })])).toEqual([]);
  });

  it("ignores freehand shapes entirely — they mark a zone, not a movement", () => {
    const tokens = [player("p1", 10, 10)];
    const shapes = [arrow("a1", "free", { x: 10, y: 10 }, { x: 90, y: 90 })];
    expect(framesFromShapes(tokens, shapes)).toEqual([]);
  });

  it("moves the nearest player to a run arrow's end point", () => {
    const tokens = [player("p1", 10, 10), player("p2", 80, 80)];
    const shapes = [arrow("a1", "run", { x: 10, y: 10 }, { x: 50, y: 50 })];
    const frames = framesFromShapes(tokens, shapes);

    expect(frames).toHaveLength(2);
    // Start frame: everyone at their original position.
    expect(frames[0].tokens.find((t) => t.id === "p1")).toEqual({ id: "p1", x: 10, y: 10 });
    // After the run: p1 (the nearest to the arrow's start) moved; p2 didn't.
    expect(frames[1].tokens.find((t) => t.id === "p1")).toEqual({ id: "p1", x: 50, y: 50 });
    expect(frames[1].tokens.find((t) => t.id === "p2")).toEqual({ id: "p2", x: 80, y: 80 });
  });

  it("produces no frames when no token is within grab radius of the arrow's start", () => {
    const tokens = [player("p1", 10, 10)];
    // Arrow starts miles from the only player — nothing to grab.
    const shapes = [arrow("a1", "run", { x: 90, y: 90 }, { x: 95, y: 95 })];
    expect(framesFromShapes(tokens, shapes)).toEqual([]);
  });

  it("moves the ball, not a player, on a pass arrow", () => {
    const tokens = [player("p1", 10, 10), ball("b1", 10, 10)];
    const shapes = [arrow("a1", "pass", { x: 10, y: 10 }, { x: 60, y: 60 })];
    const frames = framesFromShapes(tokens, shapes);

    expect(frames).toHaveLength(2);
    expect(frames[1].tokens.find((t) => t.id === "b1")).toEqual({ id: "b1", x: 60, y: 60 });
    expect(frames[1].tokens.find((t) => t.id === "p1")).toEqual({ id: "p1", x: 10, y: 10 });
  });

  it("does not throw when a pass arrow is drawn with no ball on the board", () => {
    const tokens = [player("p1", 10, 10)];
    const shapes = [arrow("a1", "pass", { x: 10, y: 10 }, { x: 60, y: 60 })];
    // No ball to move and no player moved either — nothing to animate.
    expect(framesFromShapes(tokens, shapes)).toEqual([]);
  });

  it("carries the ball along with the player on a dribble arrow", () => {
    const tokens = [player("p1", 10, 10), ball("b1", 10, 10)];
    const shapes = [arrow("a1", "dribble", { x: 10, y: 10 }, { x: 70, y: 70 })];
    const frames = framesFromShapes(tokens, shapes);

    expect(frames).toHaveLength(2);
    expect(frames[1].tokens.find((t) => t.id === "p1")).toEqual({ id: "p1", x: 70, y: 70 });
    expect(frames[1].tokens.find((t) => t.id === "b1")).toEqual({ id: "b1", x: 70, y: 70 });
  });

  it("applies a sequence of arrows in drawn order, one frame per arrow", () => {
    const tokens = [player("p1", 0, 0), ball("b1", 0, 0)];
    const shapes = [
      arrow("a1", "run", { x: 0, y: 0 }, { x: 20, y: 0 }),
      arrow("a2", "pass", { x: 20, y: 0 }, { x: 40, y: 0 }),
    ];
    const frames = framesFromShapes(tokens, shapes);

    expect(frames).toHaveLength(3); // start + one per arrow
    expect(frames[1].tokens.find((t) => t.id === "p1")).toEqual({ id: "p1", x: 20, y: 0 });
    expect(frames[2].tokens.find((t) => t.id === "b1")).toEqual({ id: "b1", x: 40, y: 0 });
    // Each frame accumulates the shapes drawn up to that point.
    expect(frames[1].shapes.map((s) => s.id)).toEqual(["a1"]);
    expect(frames[2].shapes.map((s) => s.id)).toEqual(["a1", "a2"]);
  });

  it("grabs the nearer of two players within radius, not just the first in the list", () => {
    const tokens = [player("far", 5, 5), player("near", 1, 1)];
    const shapes = [arrow("a1", "run", { x: 0, y: 0 }, { x: 30, y: 30 })];
    const frames = framesFromShapes(tokens, shapes);
    expect(frames[1].tokens.find((t) => t.id === "near")).toEqual({ id: "near", x: 30, y: 30 });
    expect(frames[1].tokens.find((t) => t.id === "far")).toEqual({ id: "far", x: 5, y: 5 });
  });

  it("never grabs the ball as if it were a player on a run arrow", () => {
    const tokens = [ball("b1", 0, 0)];
    const shapes = [arrow("a1", "run", { x: 0, y: 0 }, { x: 50, y: 50 })];
    expect(framesFromShapes(tokens, shapes)).toEqual([]);
  });
});
