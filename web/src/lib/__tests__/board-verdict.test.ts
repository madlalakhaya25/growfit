import { longPassMetres, willItWork } from "../board-verdict";
import type { Shape } from "../board-model";

const pitch = { metresPerUnit: 0.6 };
const tok = (id: string, kind: "player" | "opponent" | "ball", x: number, y: number, group = "Midfielder") =>
  ({ id, label: id.toUpperCase(), kind, group, x, y });
const pass = (from: string, to: string, a: [number, number], b: [number, number]): Shape => ({
  id: `s-${from}-${to}`, kind: "pass", pts: [{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }], fromTokenId: from, toTokenId: to,
});

// Two opponents back at y=20 and 25 so the offside line is y=25 (their second last).
const opp = [tok("gk", "opponent", 50, 5, "Goalkeeper"), tok("d1", "opponent", 80, 25, "Defender"), tok("d2", "opponent", 20, 25, "Defender")];

describe("willItWork: passes", () => {
  it("is good when the lane is clear and the receiver is onside", () => {
    const tokens = [tok("a", "player", 50, 100), tok("b", "player", 50, 80), ...opp];
    const [v] = willItWork(tokens, [pass("a", "b", [50, 100], [50, 80])], pitch, "U13").items;
    expect(v.level).toBe("good");
    expect(v.text).toBe("A to B: clear lane, onside.");
  });

  it("is poor when a defender stands in the lane", () => {
    const tokens = [tok("a", "player", 50, 100), tok("b", "player", 50, 70), tok("x", "opponent", 51, 85), ...opp];
    const [v] = willItWork(tokens, [pass("a", "b", [50, 100], [50, 70])], pitch, "U13").items;
    expect(v.level).toBe("poor");
    expect(v.text).toMatch(/in the way/);
  });

  it("is risky when a defender is close to the lane, but not in it", () => {
    const tokens = [tok("a", "player", 50, 100), tok("b", "player", 50, 70), tok("x", "opponent", 55, 85), ...opp];
    expect(willItWork(tokens, [pass("a", "b", [50, 100], [50, 70])], pitch, "U13").items[0].level).toBe("risky");
  });

  it("is poor when the receiver is beyond the offside line", () => {
    const tokens = [tok("a", "player", 50, 100), tok("b", "player", 50, 15), ...opp];
    const [v] = willItWork(tokens, [pass("a", "b", [50, 100], [50, 15])], pitch, "U15").items;
    expect(v.level).toBe("poor");
    expect(v.text).toMatch(/B is offside/);
  });

  it("calls a long pass risky for the age and fine for an older group", () => {
    const tokens = [tok("a", "player", 50, 120), tok("b", "player", 50, 80), ...opp];
    const s = [pass("a", "b", [50, 120], [50, 80])]; // 40 units * 0.6 = 24 m
    expect(willItWork(tokens, s, pitch, "U11").items[0].text).toMatch(/24 m is a long pass/);
    expect(willItWork(tokens, s, pitch, "U15").items[0].level).toBe("good");
    expect(longPassMetres("U11")).toBe(15);
  });

  it("says a pass into space needs someone to arrive, and skips a pass nobody starts", () => {
    const tokens = [tok("a", "player", 50, 100), ...opp];
    const open: Shape = { id: "p", kind: "pass", pts: [{ x: 50, y: 100 }, { x: 70, y: 60 }] };
    const [v] = willItWork(tokens, [open], pitch, "U13").items;
    expect(v.level).toBe("risky");
    expect(willItWork(tokens, [{ ...open, pts: [{ x: 5, y: 140 }, { x: 70, y: 60 }] }], pitch, "U13").items).toEqual([]);
  });
});

describe("willItWork: runs and the summary", () => {
  it("reads a run against the nearest defender and counts the levels", () => {
    const tokens = [tok("a", "player", 50, 100), tok("b", "player", 50, 80), tok("c", "player", 20, 100), tok("x", "opponent", 20, 40), ...opp];
    const run: Shape = { id: "r1", kind: "run", pts: [{ x: 20, y: 100 }, { x: 20, y: 45 }] }; // C runs to where X already is
    const out = willItWork(tokens, [pass("a", "b", [50, 100], [50, 80]), run], pitch, "U13");
    expect(out.items.map((i) => i.level)).toEqual(["good", "poor"]);
    expect([out.good, out.risky, out.poor]).toEqual([1, 0, 1]);
  });
});
