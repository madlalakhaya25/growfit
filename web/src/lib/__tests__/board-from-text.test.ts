import { BOARD_H, BOARD_W } from "../board-model";
import { FORMATIONS } from "../formations";
import { MAX_SKETCH_SHAPES, buildBoard, formationMenu, validateBoardSketch } from "../board-from-text";

const f433 = FORMATIONS.find((f) => f.id === "11-4-3-3")!;
const lbSlot = f433.slots.findIndex((s) => s.role === "lb");

const raw = (over: Record<string, unknown> = {}) => ({
  formationId: "11-4-3-3",
  name: "High press",
  shapes: [{ kind: "run", fromSlot: lbSlot, to: { x: 10, y: 40 } }],
  ...over,
});
const ok = (r: ReturnType<typeof validateBoardSketch>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe("validateBoardSketch", () => {
  it("accepts a real formation of the right size, with an arrow anchored to a slot", () => {
    const r = ok(validateBoardSketch(raw(), 11));
    expect(r.sketch.formationId).toBe("11-4-3-3");
    expect(r.sketch.shapes).toEqual([{ kind: "run", fromSlot: lbSlot, toSlot: undefined, to: { x: 10, y: 40 } }]);
    expect(r.dropped).toBe(0);
  });
  it("refuses a formation whose size isn't the board's, saying why", () => {
    const r = validateBoardSketch(raw({ formationId: "7-2-3-1" }), 11);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/7-a-side.*11-a-side/);
  });
  it("refuses a formation id the app doesn't have, and an unreadable reply", () => {
    expect(validateBoardSketch(raw({ formationId: "11-9-9-9" }), 11)).toMatchObject({ ok: false });
    expect(validateBoardSketch(null, 11)).toMatchObject({ ok: false });
  });
  it("clamps every coordinate to the pitch", () => {
    const r = ok(validateBoardSketch(raw({
      shapes: [
        { kind: "run", fromSlot: lbSlot, to: { x: -50, y: 9999 } },
        { kind: "zone", pts: [{ x: -5, y: -5 }, { x: 500, y: 0 }, { x: 50, y: 400 }] },
      ],
    }), 11));
    expect(r.sketch.shapes[0].to).toEqual({ x: 0, y: BOARD_H });
    expect(r.sketch.shapes[1].pts).toEqual([{ x: 0, y: 0 }, { x: BOARD_W, y: 0 }, { x: 50, y: BOARD_H }]);
  });
  it("drops kinds the board can't take or the sentence can't mean, and counts them", () => {
    const r = ok(validateBoardSketch(raw({
      shapes: [
        { kind: "laser", fromSlot: 1, to: { x: 5, y: 5 } },
        { kind: "free", fromSlot: 1, to: { x: 5, y: 5 } },
        { kind: "text", fromSlot: 1, to: { x: 5, y: 5 } },
        { kind: "pass", fromSlot: 1, toSlot: 5 },
      ],
    }), 11));
    expect(r.sketch.shapes.map((s) => s.kind)).toEqual(["pass"]);
    expect(r.dropped).toBe(3);
  });
  it("drops arrows that start off the formation, go nowhere, or have no end", () => {
    const r = ok(validateBoardSketch(raw({
      shapes: [
        { kind: "run", fromSlot: 99, to: { x: 5, y: 5 } },
        { kind: "run", fromSlot: -1, to: { x: 5, y: 5 } },
        { kind: "run", fromSlot: 2.5, to: { x: 5, y: 5 } },
        { kind: "run", fromSlot: 2 },
        { kind: "pass", fromSlot: 2, toSlot: 2 },
        { kind: "run", fromSlot: 2, to: { x: "a", y: 1 } },
      ],
    }), 11));
    expect(r.sketch.shapes).toHaveLength(0);
    expect(r.dropped).toBe(6);
  });
  it("needs 3 to 8 usable corners for a zone", () => {
    const pt = (n: number) => ({ x: n, y: n });
    const r = ok(validateBoardSketch(raw({
      shapes: [
        { kind: "zone", pts: [pt(1), pt(2)] },
        { kind: "zone", pts: Array.from({ length: 9 }, (_, i) => pt(i)) },
        { kind: "zone", pts: [pt(1), pt(2), { x: "x" }] },
        { kind: "zone", pts: [pt(1), pt(5), pt(9)], hatch: true },
      ],
    }), 11));
    expect(r.sketch.shapes).toEqual([{ kind: "zone", pts: [pt(1), pt(5), pt(9)], hatch: true }]);
  });
  it("caps the number of shapes", () => {
    const many = Array.from({ length: MAX_SKETCH_SHAPES + 5 }, () => ({ kind: "run", fromSlot: lbSlot, to: { x: 10, y: 40 } }));
    const r = ok(validateBoardSketch(raw({ shapes: many }), 11));
    expect(r.sketch.shapes).toHaveLength(MAX_SKETCH_SHAPES);
    expect(r.dropped).toBe(5);
  });
  it("still gives a formation-only board when no drawing survives", () => {
    const r = ok(validateBoardSketch(raw({ shapes: "nope" }), 11));
    expect(r.sketch.shapes).toEqual([]);
  });
  it("strips asterisks from the name and bounds it", () => {
    const r = ok(validateBoardSketch(raw({ name: "**" + "x".repeat(200) }), 11));
    expect(r.sketch.name.startsWith("*")).toBe(false);
    expect(r.sketch.name.length).toBeLessThanOrEqual(80);
  });
});

describe("buildBoard", () => {
  const sketch = ok(validateBoardSketch(raw({
    shapes: [
      { kind: "run", fromSlot: lbSlot, to: { x: 10, y: 40 } },
      { kind: "pass", fromSlot: 5, toSlot: 8 },
      { kind: "zone", pts: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 50, y: 40 }], hatch: true },
    ],
  }), 11)).sketch;

  it("puts a token on every slot, labelled by position when the roster is empty", () => {
    const { tokens } = buildBoard(sketch, []);
    expect(tokens).toHaveLength(11);
    expect(tokens.find((t) => t.label === "LB")).toBeDefined();
    expect(tokens.every((t) => t.kind === "player")).toBe(true);
  });
  it("uses real players in the slot that matches their position", () => {
    const { tokens } = buildBoard(sketch, [{ id: "p1", full_name: "Sipho Dlamini", position: "lb" }]);
    const t = tokens.find((x) => x.playerId === "p1")!;
    expect(t.label).toBe("Sipho");
    expect(t.x).toBe(f433.slots[lbSlot].x);
    expect(t.y).toBe(f433.slots[lbSlot].y);
  });
  it("starts each arrow on its slot's token and ends where asked", () => {
    const { shapes } = buildBoard(sketch, []);
    expect(shapes[0].pts[0]).toEqual({ x: f433.slots[lbSlot].x, y: f433.slots[lbSlot].y });
    expect(shapes[0].pts[1]).toEqual({ x: 10, y: 40 });
    expect(shapes[1].pts[1]).toEqual({ x: f433.slots[8].x, y: f433.slots[8].y });
    expect(shapes[2]).toMatchObject({ kind: "zone", fill: "hatch" });
  });
  it("gives every token and shape its own id", () => {
    const { tokens, shapes } = buildBoard(sketch, []);
    const ids = [...tokens, ...shapes].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("formationMenu", () => {
  it("lists every formation with indexed slots", () => {
    const menu = formationMenu();
    for (const f of FORMATIONS) expect(menu).toContain(f.id);
    expect(menu).toContain("0=gk(50,142)");
  });
});
