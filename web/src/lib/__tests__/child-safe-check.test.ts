import { checkPlayerFacing, findFlaggedWording, describeFlags } from "@/lib/child-safe-check";
import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";

const plan = (over: Partial<PlayerSafeDevelopmentPlan> = {}): PlayerSafeDevelopmentPlan => ({
  focusAreas: [{ category: "technical", area: "First touch", why: "A softer touch lets you keep the ball when a defender comes." }],
  actions: [{ what: "Wall passes", how: "Pass against a wall with each foot for five minutes.", timesPerWeek: 3, measure: "Count your clean touches.", milestoneTemplateId: null }],
  reviewDate: "2026-11-01",
  playerNote: "You have been working hard. Keep enjoying the ball.",
  ...over,
});

describe("findFlaggedWording", () => {
  it("flags deficit words and comparisons", () => {
    expect(findFlaggedWording("Your passing is poor and you struggle")).toEqual(expect.arrayContaining(["poor", "struggle"]));
    expect(findFlaggedWording("You are better than the other players")).toEqual(expect.arrayContaining(["better than", "other players"]));
  });
  it("matches whole words only, ignoring case", () => {
    expect(findFlaggedWording("A POOR start is fine")).toContain("poor");
    expect(findFlaggedWording("poorly lit")).toEqual(expect.arrayContaining(["poorly"]));
    expect(findFlaggedWording("lacksadaisical")).toEqual([]);
    expect(findFlaggedWording("Keep the ball low, stay behind the ball and slow it down. Never give up.")).toEqual([]);
  });
  it("does not flag warm, growth-focused wording", () => {
    expect(findFlaggedWording("You are growing in confidence. Next, try the ball with your left foot.")).toEqual([]);
  });
});

describe("checkPlayerFacing", () => {
  it("is clean for a warm plan", () => {
    expect(checkPlayerFacing(plan())).toEqual([]);
  });
  it("says where the flagged wording is", () => {
    const flags = checkPlayerFacing(plan({ playerNote: "Your attendance was poor this term." }));
    expect(flags).toEqual([{ where: "note to the player", phrases: expect.arrayContaining(["poor"]) }]);
    expect(describeFlags(flags)).toMatch(/note to the player: .*"poor"/);
  });
  it("looks in focus areas and actions too", () => {
    const flags = checkPlayerFacing(plan({
      focusAreas: [{ category: "tactical", area: "Positioning", why: "You are weak at covering." }],
      actions: [{ what: "Cover drill", how: "You often fail to track back.", timesPerWeek: 2, measure: "", milestoneTemplateId: null }],
    }));
    expect(flags.map((f) => f.where)).toEqual(["focus 1 reason", "action 1 how"]);
  });
});
