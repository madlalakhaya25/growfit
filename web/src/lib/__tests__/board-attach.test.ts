import { attachArrow, followAttached, nearestToken, type Shape } from "../board-model";

const tokens = [
  { id: "a", x: 20, y: 30 },
  { id: "b", x: 60, y: 30 },
  { id: "c", x: 22, y: 31 },
];
const arrow = (kind: Shape["kind"], from: [number, number], to: [number, number]): Shape => ({
  id: "s1", kind, pts: [{ x: from[0], y: from[1] }, { x: to[0], y: to[1] }], curve: 0.2,
});

describe("nearestToken", () => {
  it("picks the closest within range, none beyond it, and honours the exception", () => {
    expect(nearestToken(tokens, { x: 21.6, y: 30.8 })?.id).toBe("c");
    expect(nearestToken(tokens, { x: 40, y: 80 })).toBeNull();
    expect(nearestToken(tokens, { x: 21.6, y: 30.8 }, 4, "c")?.id).toBe("a");
  });
});

describe("attachArrow", () => {
  it("joins the start to the player it begins on and snaps the start to them", () => {
    const out = attachArrow(arrow("run", [20.5, 30.5], [20, 60]), tokens);
    expect(out.fromTokenId).toBe("a");
    expect(out.pts[0]).toEqual({ x: 20, y: 30 });
    expect(out.toTokenId).toBeUndefined();
    expect(out.curve).toBe(0.2);
  });

  it("joins a pass at both ends, and never to the same player twice", () => {
    const out = attachArrow(arrow("pass", [20, 30], [60.5, 30]), tokens);
    expect([out.fromTokenId, out.toTokenId]).toEqual(["a", "b"]);
    expect(attachArrow(arrow("pass", [20, 30], [20.5, 30]), tokens).toTokenId).toBe("c");
  });

  it("leaves an arrow that starts in open space, and non-arrows, alone", () => {
    const free = arrow("run", [40, 100], [40, 120]);
    expect(attachArrow(free, tokens)).toBe(free);
    const zone = { ...arrow("zone", [20, 30], [30, 40]) };
    expect(attachArrow(zone, tokens)).toBe(zone);
  });
});

describe("followAttached", () => {
  it("moves an attached arrow's ends with their tokens and keeps the curve", () => {
    const sh = { ...arrow("pass", [20, 30], [60, 30]), fromTokenId: "a", toTokenId: "b" };
    const moved = tokens.map((t) => (t.id === "a" ? { ...t, x: 25, y: 50 } : t));
    const [out] = followAttached([sh], moved);
    expect(out.pts).toEqual([{ x: 25, y: 50 }, { x: 60, y: 30 }]);
    expect(out.curve).toBe(0.2);
  });

  it("keeps the old end when a token is gone, and the same array when nothing moved", () => {
    const sh = { ...arrow("run", [20, 30], [20, 60]), fromTokenId: "gone" };
    const shapes = [sh];
    expect(followAttached(shapes, tokens)).toBe(shapes);
    const attached = { ...arrow("run", [20, 30], [20, 60]), fromTokenId: "a" };
    const list = [attached];
    expect(followAttached(list, tokens)).toBe(list);
  });

  it("does not touch free arrows", () => {
    const free = arrow("run", [5, 5], [9, 9]);
    const list = [free];
    expect(followAttached(list, tokens)).toBe(list);
  });
});
