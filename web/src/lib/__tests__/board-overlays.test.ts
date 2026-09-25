import { passingLanes, spaceControl, offsideLines, zoneCounts } from "@/lib/board-overlays";
import { getPitch } from "@/lib/board-model";

const full = getPitch("full");
let n = 0;
const us = (x: number, y: number, group = "Midfielder") => ({ id: `u${++n}`, kind: "player" as const, group, x, y });
const them = (x: number, y: number) => ({ id: `o${++n}`, kind: "opponent" as const, group: "Opponent", x, y });
const ball = (x: number, y: number) => ({ id: "ball", kind: "ball" as const, group: "Ball", x, y });

describe("passingLanes", () => {
  it("rates each lane by the nearest opponent to it", () => {
    const carrier = us(50, 100);
    const clear = us(20, 100);
    const cut = us(50, 60);
    const tight = us(80, 100);
    const { carrierId, lanes } = passingLanes(
      [carrier, clear, cut, tight, ball(51, 101), them(50, 80), them(65, 105)],
      full
    );
    expect(carrierId).toBe(carrier.id);
    const status = Object.fromEntries(lanes.map((l) => [l.toId, l.status]));
    expect(status).toEqual({ [clear.id]: "open", [cut.id]: "blocked", [tight.id]: "risky" });
    expect(lanes.find((l) => l.toId === cut.id)!.forward).toBe(true);
    expect(lanes.find((l) => l.toId === clear.id)!.lengthM).toBeCloseTo(30 * full.metresPerUnit);
  });

  it("ignores opponents behind the passer or beyond the receiver", () => {
    const a = us(50, 100), b = us(50, 80);
    const { lanes } = passingLanes([a, b, ball(50, 100), them(50, 110), them(50, 70)], full);
    expect(lanes[0].status).toBe("open");
  });

  it("needs a ball at someone's feet", () => {
    expect(passingLanes([us(50, 100), us(20, 100)], full).lanes).toEqual([]);
    expect(passingLanes([us(50, 100), us(20, 100), ball(10, 10)], full).carrierId).toBeNull();
  });

  it("never offers a pass to our keeper", () => {
    const { lanes } = passingLanes([us(50, 100), us(50, 146, "Goalkeeper"), ball(50, 100)], full);
    expect(lanes).toEqual([]);
  });
});

describe("spaceControl", () => {
  it("splits the pitch down the middle between two mirrored players", () => {
    const c = spaceControl([us(25, 75), them(75, 75)], full)!;
    expect(c.oursPct).toBe(50);
    expect(c.thirdsPct).toEqual([50, 50, 50]);
  });

  it("gives us the pitch our players are nearer to, per third", () => {
    const c = spaceControl([us(50, 140), them(50, 10)], full)!;
    expect(c.thirdsPct[0]).toBe(0);
    expect(c.thirdsPct[2]).toBe(100);
    expect(c.runs.every((r) => r.x2 > r.x1)).toBe(true);
  });

  it("needs both sides", () => {
    expect(spaceControl([us(50, 100)], full)).toBeNull();
  });
});

describe("offsideLines", () => {
  it("draws the line at their second-last player and flags anyone beyond it", () => {
    const beyond = us(40, 20), level = us(60, 30);
    const r = offsideLines([them(50, 4), them(40, 30), them(60, 32), beyond, level, ball(50, 60)], full);
    expect(r.offsideY).toBe(30);
    expect(r.offsideIds).toEqual([beyond.id]);
  });

  it("is never deeper than halfway, and the ball can move it forward", () => {
    const deep = offsideLines([them(50, 100), them(50, 120), us(50, 80)], full);
    expect(deep.offsideY).toBe(75);
    expect(deep.offsideIds).toEqual([]);
    const ahead = offsideLines([them(50, 4), them(50, 30), ball(50, 20), us(50, 25)], full);
    expect(ahead.offsideY).toBe(20);
    expect(ahead.offsideIds).toEqual([]);
  });

  it("measures the gaps between each side's lines", () => {
    const r = offsideLines(
      [us(30, 130, "Defender"), us(70, 130, "Defender"), us(50, 110, "Midfielder"), us(50, 90, "Forward"),
        them(30, 20), them(70, 20), them(30, 40), them(70, 40)],
      full
    );
    expect(r.ourLastLineY).toBe(130);
    expect(r.ourGapsM.map((m) => Math.round(m / full.metresPerUnit))).toEqual([20, 20]);
    expect(r.theirGapsM.map((m) => Math.round(m / full.metresPerUnit))).toEqual([20]);
  });
});

describe("zoneCounts", () => {
  it("counts outfield players per zone and skips empty zones", () => {
    const counts = zoneCounts([
      us(50, 60), us(45, 70), them(55, 65), them(10, 10),
      us(50, 146, "Goalkeeper"),
    ]);
    expect(counts).toEqual([
      { zoneId: "A-LW", us: 0, them: 1 },
      { zoneId: "M-C", us: 2, them: 1 },
    ]);
  });
});
