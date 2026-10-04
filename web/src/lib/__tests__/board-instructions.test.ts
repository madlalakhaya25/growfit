import {
  INSTRUCTION_ACTIONS, MAX_INSTRUCTIONS, instructionLine, planInstructions, playersMenu, readInstructions, validateInstructions,
  type Instruction,
} from "../board-instructions";
import type { Token } from "../board-model";

const tok = (id: string, label: string, x: number, y: number, group = "Defender"): Token => ({ id, label, x, y, kind: "player", group });
const opp = (id: string, x: number, y: number): Token => ({ id, label: "o", x, y, kind: "opponent", group: "Opponent" });

// 0 LB (left, deep), 1 LW (left, ahead), 2 CAM (central), 3 RB, 4 ST
const team = [
  tok("lb", "LB", 14, 108), tok("lw", "LW", 12, 70, "Forward"), tok("cam", "10", 50, 74, "Midfielder"),
  tok("rb", "RB", 86, 108), tok("st", "ST", 50, 40, "Forward"),
];
const one = (ins: Instruction, opps: Token[] = []) => planInstructions(team, opps, [ins]);
const end = (ins: Instruction, opps: Token[] = []) => one(ins, opps).planned[0]?.shape?.pts[1];

describe("validateInstructions", () => {
  it("keeps known actions on real players and counts the rest", () => {
    const r = validateInstructions({
      instructions: [
        { action: "overlap", player: 0, target: 1 },
        { action: "fly", player: 0 },
        { action: "drop", player: 99 },
        { action: "press", player: 4 },
        { action: "cover", player: 0 },
        { action: "shift_across", player: 3 },
      ],
    }, 5);
    expect(r).toEqual({ ok: true, dropped: 4, instructions: [{ action: "overlap", player: 0, target: 1 }, { action: "press", player: 4 }] });
  });
  it("ignores a target that is the player themselves and a direction that is not left or right", () => {
    const r = validateInstructions({ instructions: [{ action: "overlap", player: 0, target: 0, direction: "up" }] }, 5);
    expect(r).toEqual({ ok: true, dropped: 0, instructions: [{ action: "overlap", player: 0 }] });
  });
  it("caps the list", () => {
    const many = Array.from({ length: 20 }, () => ({ action: "drop", player: 0 }));
    const r = validateInstructions({ instructions: many }, 5);
    expect(r.ok && r.instructions).toHaveLength(MAX_INSTRUCTIONS);
    expect(r.ok && r.dropped).toBe(20 - MAX_INSTRUCTIONS);
  });
  it("fails when nothing usable is left, and on an unreadable answer", () => {
    expect(validateInstructions({ instructions: [] }, 5).ok).toBe(false);
    expect(validateInstructions(null, 5).ok).toBe(false);
  });
  it("knows exactly the ten actions the plan names", () => {
    expect([...INSTRUCTION_ACTIONS]).toHaveLength(10);
  });
});

describe("planInstructions", () => {
  it("overlap runs outside the teammate and past them, up the pitch", () => {
    const to = end({ action: "overlap", player: 0, target: 1 })!;
    expect(to.x).toBeLessThan(12);
    expect(to.y).toBeLessThan(70);
  });
  it("overlap without a target picks the wide teammate ahead", () => {
    const p = one({ action: "overlap", player: 0 }).planned[0];
    expect(p.text).toBe("LB overlaps LW");
  });
  it("overlap on the right flank goes the other way", () => {
    const rb = [...team.slice(0, 3), tok("rw", "RW", 88, 70, "Forward"), team[3]];
    const plan = planInstructions(rb, [], [{ action: "overlap", player: 4, target: 3 }]);
    expect(plan.planned[0].shape!.pts[1].x).toBeGreaterThan(88);
  });
  it("underlap runs inside the teammate", () => {
    const to = end({ action: "underlap", player: 0, target: 1 })!;
    expect(to.x).toBeGreaterThan(12);
    expect(to.y).toBeLessThan(70);
  });
  it("drop goes toward their own goal", () => {
    expect(end({ action: "drop", player: 2 })!.y).toBeGreaterThan(74);
  });
  it("invert brings a wide player inside; a central player has nothing to invert", () => {
    expect(end({ action: "invert", player: 1 })!.x).toBeGreaterThan(12);
    const r = one({ action: "invert", player: 2 });
    expect(r.planned).toHaveLength(0);
    expect(r.skipped[0]).toMatch(/already in the middle/);
  });
  it("stay_wide holds the touchline on the player's own side", () => {
    expect(end({ action: "stay_wide", player: 0 })!.x).toBe(8);
    expect(end({ action: "stay_wide", player: 3 })!.x).toBe(92);
  });
  it("attack_box ends in the penalty area", () => {
    const to = end({ action: "attack_box", player: 4 })!;
    expect(to.y).toBeLessThanOrEqual(20);
    expect(to.x).toBeGreaterThan(38);
    expect(to.x).toBeLessThan(62);
  });
  it("press closes down the nearest opponent as a press arrow, and pushes up without one", () => {
    const withOpp = one({ action: "press", player: 4 }, [opp("o1", 50, 20), opp("o2", 90, 20)]).planned[0].shape!;
    expect(withOpp.kind).toBe("press");
    expect(withOpp.pts[1].y).toBeLessThan(40);
    expect(withOpp.pts[1].y).toBeGreaterThan(20);
    expect(end({ action: "press", player: 4 })!.y).toBe(26);
  });
  it("cover drops in behind and inside the teammate", () => {
    const to = end({ action: "cover", player: 2, target: 1 })!;
    expect(to.y).toBeGreaterThan(70);
    expect(to.x).toBeGreaterThan(12);
  });
  it("shift_across slides sideways the asked way and stays on the pitch", () => {
    expect(end({ action: "shift_across", player: 2, direction: "left" })).toEqual({ x: 38, y: 74 });
    expect(end({ action: "shift_across", player: 3, direction: "right" })!.x).toBe(94);
  });
  it("hold draws nothing but is listed", () => {
    const r = one({ action: "hold", player: 0 });
    expect(r.planned[0].shape).toBeUndefined();
    expect(r.planned[0].text).toBe("LB holds position");
  });
  it("joins each run to its player and is repeatable", () => {
    const a = one({ action: "drop", player: 2 }).planned[0].shape!;
    const b = one({ action: "drop", player: 2 }).planned[0].shape!;
    expect(a.fromTokenId).toBe("cam");
    expect(a.pts).toEqual(b.pts);
  });
  it("skips a run that ends where it starts", () => {
    const r = planInstructions([tok("a", "A", 8, 70)], [], [{ action: "stay_wide", player: 0 }]);
    expect(r.planned).toHaveLength(0);
    expect(r.skipped[0]).toMatch(/already there/);
  });
});

describe("menus and saved words", () => {
  it("lists players by number without coordinates", () => {
    expect(playersMenu(team).split("\n")[1]).toBe("1 = LW (Forward, left, middle third)");
  });
  it("tidies and reads back saved instructions", () => {
    expect(instructionLine("  left   back \n overlaps ")).toBe("left back overlaps");
    expect(readInstructions(["a", "", 3, "b"])).toEqual(["a", "b"]);
    expect(readInstructions("no")).toBeUndefined();
    expect(readInstructions([])).toBeUndefined();
  });
});
