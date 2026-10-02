import { addOpponentReaction } from "../opponent-reaction";

const opp = (id: string, x: number, y: number, group = "Defender") => ({ id, label: id, kind: "opponent" as const, group, x, y });
const start = [
  { id: "ball", label: "", kind: "ball" as const, group: "Ball", x: 50, y: 75 },
  { id: "me", label: "me", kind: "player" as const, group: "Midfielder", x: 50, y: 90 },
  opp("gk", 50, 6, "Goalkeeper"), opp("d1", 20, 25), opp("d2", 50, 25), opp("d3", 80, 25),
];
const frame = (id: string, ball: [number, number], extra: Record<string, [number, number]> = {}) => ({
  id,
  tokens: start.map((t) => ({ id: t.id, x: extra[t.id]?.[0] ?? (t.id === "ball" ? ball[0] : t.x), y: extra[t.id]?.[1] ?? (t.id === "ball" ? ball[1] : t.y) })),
});

describe("addOpponentReaction", () => {
  it("leaves the resting frame alone and slides the block toward the ball in later frames", () => {
    const frames = [frame("f0", [50, 75]), frame("f1", [90, 60])];
    const out = addOpponentReaction(frames, start);
    expect(out[0]).toBe(frames[0]);
    const d1 = out[1].tokens.find((t) => t.id === "d1")!;
    const d3 = out[1].tokens.find((t) => t.id === "d3")!;
    expect(d1.x).toBeGreaterThan(20); // the whole block slid right, toward the ball
    expect(d3.x).toBeGreaterThan(80 - 1 - 20);
    expect(d1.x).not.toBe(20);
  });

  it("never moves our players or the ball", () => {
    const out = addOpponentReaction([frame("f0", [50, 75]), frame("f1", [90, 60])], start);
    expect(out[1].tokens.find((t) => t.id === "me")).toEqual({ id: "me", x: 50, y: 90 });
    expect(out[1].tokens.find((t) => t.id === "ball")).toEqual({ id: "ball", x: 90, y: 60 });
  });

  it("leaves an opponent the coach moved themself exactly where the coach put them", () => {
    const out = addOpponentReaction([frame("f0", [50, 75]), frame("f1", [90, 60], { d2: [55, 40] })], start);
    expect(out[1].tokens.find((t) => t.id === "d2")).toEqual({ id: "d2", x: 55, y: 40 });
    expect(out[1].tokens.find((t) => t.id === "d1")!.x).not.toBe(20);
  });

  it("does nothing without a ball, a set-up opponent side, or a second frame", () => {
    const frames = [frame("f0", [50, 75]), frame("f1", [90, 60])];
    expect(addOpponentReaction(frames, start.filter((t) => t.kind !== "ball"))).toBe(frames);
    expect(addOpponentReaction(frames, start.filter((t) => t.kind !== "opponent" || t.id === "gk"))).toBe(frames);
    expect(addOpponentReaction([frames[0]], start)).toEqual([frames[0]]);
  });
});
