import { shiftToBall, reachTimes, runSpeedFor, pressingPlan, playerJobs } from "@/lib/board-coaching";
import { compress, getPitch, type Shape } from "@/lib/board-model";
import { FORMATIONS } from "@/lib/formations";

const full = getPitch("full");
function opp442() {
  const f = FORMATIONS.find((x) => x.id === "11-4-4-2")!;
  return f.slots.map((slot, i) => ({ id: `o${i}`, label: String(i + 1), kind: "opponent" as const, group: "Opponent", ...compress(slot, "away") }));
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("shiftToBall", () => {
  it("slides the block toward a wide ball and narrows it", () => {
    const anchors = opp442();
    const moved = shiftToBall(anchors, { x: 90, y: 40 }, "opponent");
    const outfield = anchors.slice(1);
    const before = outfield.map((t) => t.x), after = outfield.map((t) => moved.get(t.id)!.x);
    expect(mean(after)).toBeGreaterThan(mean(before) + 10);
    expect(Math.max(...after) - Math.min(...after)).toBeLessThan(Math.max(...before) - Math.min(...before));
  });

  it("sends the nearest player to press and shades the keeper across", () => {
    const anchors = opp442();
    const ball = { x: 85, y: 45 };
    const moved = shiftToBall(anchors, ball, "opponent");
    const closest = Math.min(...anchors.slice(1).map((t) => Math.hypot(moved.get(t.id)!.x - ball.x, moved.get(t.id)!.y - ball.y)));
    expect(closest).toBeLessThanOrEqual(3.1);
    expect(moved.get("o0")!.y).toBe(anchors[0].y);
    expect(moved.get("o0")!.x).toBeGreaterThan(50);
  });

  it("returns to the anchors when the ball comes back to the centre of their block", () => {
    const anchors = opp442();
    const cy = mean(anchors.slice(1).map((t) => t.y));
    const moved = shiftToBall(anchors, { x: 50, y: cy }, "opponent");
    // Only the presser leaves his spot; everyone else is within the 10% depth squeeze.
    const shifted = anchors.slice(1).filter((t) => Math.abs(moved.get(t.id)!.x - t.x) > 0.01);
    expect(shifted.length).toBeLessThanOrEqual(1);
  });

  it("never pushes their back line into their own goal", () => {
    const moved = shiftToBall(opp442(), { x: 50, y: 3 }, "opponent");
    expect(Math.min(...[...moved.values()].map((p) => p.y))).toBeGreaterThanOrEqual(3);
  });
});

describe("reachTimes", () => {
  it("scales with age group", () => {
    expect(runSpeedFor("U11")).toBeLessThan(runSpeedFor("U15"));
    expect(runSpeedFor("Seniors")).toBe(runSpeedFor("U15"));
  });

  it("times a run and compares it with the nearest opponent", () => {
    const tokens = [
      { id: "p", label: "Sipho", kind: "player" as const, group: "Forward", x: 50, y: 100 },
      { id: "o", label: "4", kind: "opponent" as const, group: "Opponent", x: 50, y: 30 },
    ];
    const run: Shape = { id: "r", kind: "run", pts: [{ x: 50, y: 100 }, { x: 50, y: 80 }] };
    const [rt] = reachTimes(tokens, [run], full, "U13");
    expect(rt.seconds).toBeCloseTo((20 * full.metresPerUnit) / 5.2);
    expect(rt.verdict).toBe("first");
    const far: Shape = { id: "f", kind: "run", pts: [{ x: 50, y: 100 }, { x: 50, y: 35 }] };
    expect(reachTimes(tokens, [far], full, "U13")[0].verdict).toBe("late");
  });
});

describe("pressingPlan", () => {
  it("presses the carrier, covers his two nearest outlets and marks the rest", () => {
    const tokens = [
      { id: "ball", label: "", kind: "ball" as const, group: "Ball", x: 50, y: 60 },
      { id: "c", label: "6", kind: "opponent" as const, group: "Opponent", x: 50, y: 58 },
      { id: "o1", label: "7", kind: "opponent" as const, group: "Opponent", x: 30, y: 55 },
      { id: "o2", label: "8", kind: "opponent" as const, group: "Opponent", x: 70, y: 55 },
      { id: "o3", label: "9", kind: "opponent" as const, group: "Opponent", x: 50, y: 90 },
      ...[[50, 75], [35, 80], [65, 80], [50, 110], [30, 120]].map(([x, y], i) => ({ id: `p${i}`, label: String(i), kind: "player" as const, group: "Midfielder", x, y })),
    ];
    const plan = pressingPlan(tokens);
    expect(plan.carrierId).toBe("c");
    expect(plan.roles.filter((r) => r.role === "press")).toHaveLength(1);
    expect(plan.roles.filter((r) => r.role === "cover")).toHaveLength(2);
    expect(plan.roles.filter((r) => r.role === "mark")).toHaveLength(1);
    expect(plan.shapes[0].kind).toBe("press");
    expect(new Set(plan.roles.map((r) => r.tokenId)).size).toBe(plan.roles.length);
  });

  it("does nothing without an opponent on the ball", () => {
    expect(pressingPlan([{ id: "ball", label: "", kind: "ball", group: "Ball", x: 50, y: 60 }]).shapes).toEqual([]);
  });
});

describe("playerJobs", () => {
  it("writes each player's job in drawing order", () => {
    const tokens = [
      { id: "a", label: "Sipho", kind: "player" as const, group: "Midfielder", x: 50, y: 100 },
      { id: "b", label: "Thabo", kind: "player" as const, group: "Forward", x: 20, y: 70 },
      { id: "ball", label: "", kind: "ball" as const, group: "Ball", x: 50, y: 100 },
    ];
    const shapes: Shape[] = [
      { id: "1", kind: "pass", pts: [{ x: 50, y: 100 }, { x: 21, y: 71 }] },
      { id: "2", kind: "run", pts: [{ x: 50, y: 100 }, { x: 50, y: 40 }] },
      { id: "3", kind: "shot", pts: [{ x: 20, y: 70 }, { x: 50, y: 3 }] },
    ];
    const jobs = playerJobs(tokens, shapes, full);
    const sipho = jobs.find((j) => j.label === "Sipho")!;
    expect(sipho.steps[0]).toMatch(/^1\. Pass to Thabo \(\d+m\)$/);
    expect(sipho.steps[1]).toMatch(/^2\. Run \d+m into the attacking third — centre$/);
    expect(jobs.find((j) => j.label === "Thabo")!.steps).toEqual(["1. Receive the pass from Sipho", "3. Shoot at goal"]);
  });
});
