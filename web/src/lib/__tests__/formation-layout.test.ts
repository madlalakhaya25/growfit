import { FORMATIONS } from "@/lib/formations";
import { gapBetween, layoutTeams, opposite, separate, MIN_GAP, type ShapePhase, type Spot } from "@/lib/formation-layout";

const byId = (id: string) => FORMATIONS.find((f) => f.id === id)!;
const PHASES: ShapePhase[] = ["base", "attack", "defend"];

function closest(spots: Spot[]): number {
  let best = Infinity;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      best = Math.min(best, gapBetween(spots[i], spots[j]));
    }
  }
  return best;
}

describe("layoutTeams: nobody clashes", () => {
  // Every pair of formations of the same size, in every phase.
  const SIZES = [5, 7, 9, 11] as const;
  for (const size of SIZES) {
    const set = FORMATIONS.filter((f) => f.size === size);
    for (const h of set) {
      for (const a of set) {
        it(`${h.id} v ${a.id}: players keep a clear step apart in every phase`, () => {
          for (const phase of PHASES) {
            const { home, away } = layoutTeams(h.slots, a.slots, phase);
            // A hair under the target: the spacing pass stops once a pair is
            // within a rounding error of it.
            expect(closest([...home, ...away])).toBeGreaterThanOrEqual(MIN_GAP - 0.5);
          }
        });
      }
    }
  }

  it("keeps every player on the pitch", () => {
    for (const h of FORMATIONS.filter((f) => f.size === 11)) {
      for (const phase of PHASES) {
        const { home, away } = layoutTeams(h.slots, byId("11-4-4-2").slots, phase);
        for (const s of [...home, ...away]) {
          expect(s.x).toBeGreaterThanOrEqual(0);
          expect(s.x).toBeLessThanOrEqual(100);
          expect(s.y).toBeGreaterThanOrEqual(0);
          expect(s.y).toBeLessThanOrEqual(150);
        }
      }
    }
  });
});

describe("layoutTeams: shapes by phase", () => {
  const f = byId("11-4-4-2");
  const lb = f.slots.findIndex((s) => s.role === "lb");
  const st = f.slots.findIndex((s) => s.role === "st");

  it("a lone team keeps the formation as drawn at base", () => {
    const { home } = layoutTeams(f.slots, null, "base");
    expect(home[lb]).toEqual({ x: f.slots[lb].x, y: f.slots[lb].y });
  });

  it("full backs push up the pitch with the ball and come back without it", () => {
    const base = layoutTeams(f.slots, null, "base").home[lb];
    const attack = layoutTeams(f.slots, null, "attack").home[lb];
    const defend = layoutTeams(f.slots, null, "defend").home[lb];
    expect(attack.y).toBeLessThan(base.y - 20);
    expect(defend.y).toBeGreaterThanOrEqual(base.y);
  });

  it("strikers drop back without the ball", () => {
    const base = layoutTeams(f.slots, null, "base").home[st];
    expect(layoutTeams(f.slots, null, "defend").home[st].y).toBeGreaterThan(base.y);
  });

  it("when we attack, the other team defends deeper than it started", () => {
    const base = layoutTeams(f.slots, f.slots, "base");
    const attack = layoutTeams(f.slots, f.slots, "attack");
    const avg = (xs: Spot[]) => xs.reduce((n, s) => n + s.y, 0) / xs.length;
    // Away defends the top goal, so deeper means a smaller y.
    expect(avg(attack.away)).toBeLessThan(avg(base.away));
    expect(avg(attack.home)).toBeLessThan(avg(base.home));
  });

  it("opposite swaps attack and defend and leaves base alone", () => {
    expect([opposite("attack"), opposite("defend"), opposite("base")]).toEqual(["defend", "attack", "base"]);
  });
});

describe("separate", () => {
  it("pushes two players on top of each other apart, sideways", () => {
    const [a, b] = separate([{ x: 50, y: 80 }, { x: 50, y: 80 }]);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(MIN_GAP - 0.5);
    expect(a.y).toBeCloseTo(b.y, 5);
  });
  it("leaves a fixed player where they are", () => {
    const out = separate([{ x: 50, y: 146 }, { x: 52, y: 146 }], new Set([0]));
    expect(out[0]).toEqual({ x: 50, y: 146 });
    expect(Math.hypot(out[1].x - 50, 0)).toBeGreaterThanOrEqual(MIN_GAP - 0.5);
  });
  it("is deterministic", () => {
    const input = [{ x: 40, y: 70 }, { x: 44, y: 72 }, { x: 47, y: 70 }];
    expect(separate(input)).toEqual(separate(input));
  });
});
