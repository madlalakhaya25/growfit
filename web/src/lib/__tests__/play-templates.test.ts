import { BOARD_H, BOARD_W } from "../board-model";
import { getConcept } from "../tactics";
import { PLAY_TEMPLATES, expandTemplate } from "../play-templates";

const setPieces = PLAY_TEMPLATES.filter((t) => t.group === "Set pieces");

describe("play templates", () => {
  it("have unique ids and known concepts", () => {
    const ids = PLAY_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of PLAY_TEMPLATES) expect(getConcept(t.conceptId)).toBeDefined();
  });

  it("keep every token on the board, move only known tokens, and have a ball and 2+ steps", () => {
    for (const t of PLAY_TEMPLATES) {
      const known = new Set(t.tokens.map((k) => k.id));
      expect(t.tokens.some((k) => k.kind === "ball")).toBe(true);
      expect(t.steps.length).toBeGreaterThanOrEqual(2);
      for (const step of t.steps) {
        for (const [id, [x, y]] of Object.entries(step.pos)) {
          expect(known.has(id)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(BOARD_W);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(BOARD_H);
        }
        for (const [, x1, y1, x2, y2] of step.shapes ?? []) {
          for (const v of [x1, x2]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(BOARD_W); }
          for (const v of [y1, y2]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(BOARD_H); }
        }
      }
    }
  });

  it("offers corners and free kicks for both attacking and defending", () => {
    expect(setPieces.length).toBeGreaterThanOrEqual(6);
    expect(setPieces.map((t) => t.conceptId)).toEqual(expect.arrayContaining(["attacking-set-pieces", "defending-set-pieces"]));
    expect(setPieces.some((t) => /free kick/i.test(t.label))).toBe(true);
    expect(setPieces.some((t) => /corner/i.test(t.label))).toBe(true);
  });

  it("starts each play with the ball with a player, so the routine begins on the right spot", () => {
    for (const t of setPieces) {
      const { tokens } = expandTemplate(t);
      const ball = tokens.find((k) => k.kind === "ball")!;
      const near = tokens.filter((k) => k.kind !== "ball").some((k) => Math.hypot(k.x - ball.x, k.y - ball.y) <= 8);
      expect(near).toBe(true);
    }
  });
});
