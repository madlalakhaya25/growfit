import { pickHomeChallenge, weekNumber } from "../home-challenge";
import type { PlayerSafeDevelopmentPlan } from "../development-plan-view";

const act = (what: string) => ({ what, how: "how", timesPerWeek: 2, measure: "m", milestoneTemplateId: null });
const plan: PlayerSafeDevelopmentPlan = {
  focusAreas: [{ category: "technical", area: "First touch", why: "w" }],
  actions: [act("A"), act("B"), act("C")],
  reviewDate: "2026-11-15",
  playerNote: "n",
};

describe("pickHomeChallenge", () => {
  it("is the same all week and different the next", () => {
    const mon = pickHomeChallenge(plan, new Date("2026-10-05T06:00:00Z"));
    const sun = pickHomeChallenge(plan, new Date("2026-10-11T22:00:00Z"));
    const next = pickHomeChallenge(plan, new Date("2026-10-12T06:00:00Z"));
    expect(sun?.action.what).toBe(mon?.action.what);
    expect(next?.action.what).not.toBe(mon?.action.what);
  });

  it("takes each action in turn across three weeks", () => {
    const seen = [0, 1, 2].map((i) => pickHomeChallenge(plan, new Date(Date.UTC(2026, 9, 5 + 7 * i)))?.action.what);
    expect(new Set(seen).size).toBe(3);
  });

  it("only ever returns text that is in the approved plan", () => {
    const c = pickHomeChallenge(plan, new Date("2026-10-05T06:00:00Z"));
    expect(plan.actions).toContain(c?.action);
  });

  it("returns null with no actions", () => {
    expect(pickHomeChallenge({ ...plan, actions: [] }, new Date("2026-10-05"))).toBeNull();
  });

  it("returns null once the plan is well past its review date, but not just after", () => {
    expect(pickHomeChallenge(plan, new Date("2026-12-10"))).toBeNull();
    expect(pickHomeChallenge(plan, new Date("2026-11-20"))).not.toBeNull();
  });

  it("weeks tick over on Monday", () => {
    expect(weekNumber(new Date("2026-10-12T00:00:00Z"))).toBe(weekNumber(new Date("2026-10-05T00:00:00Z")) + 1);
  });
});
