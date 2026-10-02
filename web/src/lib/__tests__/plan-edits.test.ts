import { applyPlanEdits, planChanges } from "@/lib/plan-edits";
import type { DevelopmentPlanStructured } from "@/lib/development-plan-schema";

const base: DevelopmentPlanStructured = {
  playerSummary: "Summary",
  focusAreas: [{ category: "technical", area: "First touch", why: "Why" }],
  actions: [{ what: "Wall passes", how: "How", timesPerWeek: 3, measure: "Count", milestoneTemplateId: "m1" }],
  reviewDate: "2026-11-01",
  previous: { verdict: "partly", evidence: "private", carriedForward: [] },
  coachNote: "private coach note",
  playerNote: "Keep going",
};

describe("applyPlanEdits", () => {
  it("changes only the words asked for and keeps everything else", () => {
    const r = applyPlanEdits(base, {
      playerNote: "  Well done *this* term  ",
      focusAreas: [{ area: "Soft touch", why: "It helps you keep the ball" }],
      actions: [{ what: "Wall work", how: "Five minutes each foot", measure: "" }],
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.plan.playerNote).toBe("Well done this term");
    expect(r.plan.focusAreas[0]).toEqual({ category: "technical", area: "Soft touch", why: "It helps you keep the ball" });
    expect(r.plan.actions[0]).toMatchObject({ what: "Wall work", timesPerWeek: 3, milestoneTemplateId: "m1" });
    expect(r.plan.coachNote).toBe("private coach note");
    expect(r.plan.previous).toEqual(base.previous);
    expect(r.plan.reviewDate).toBe("2026-11-01");
  });

  it("applies the same length limits as generated text", () => {
    const r = applyPlanEdits(base, { playerNote: "x".repeat(2000) });
    if ("error" in r) throw new Error(r.error);
    expect(r.plan.playerNote.length).toBeLessThanOrEqual(300);
  });

  it("refuses an empty note, an empty area, and a different number of items", () => {
    expect(applyPlanEdits(base, { playerNote: "  " })).toEqual({ error: "The note to the player can't be empty." });
    expect(applyPlanEdits(base, { focusAreas: [{ area: "", why: "x" }] })).toEqual({ error: "Each focus area needs a name and a reason." });
    expect(applyPlanEdits(base, { focusAreas: [] })).toEqual({ error: "The focus areas changed. Reload and try again." });
    expect(applyPlanEdits(base, { actions: [{ what: "a", how: "b", measure: "" }, { what: "c", how: "d", measure: "" }] })).toEqual({
      error: "The actions changed. Reload and try again.",
    });
  });

  it("does not change the plan it was given", () => {
    applyPlanEdits(base, { playerNote: "New" });
    expect(base.playerNote).toBe("Keep going");
  });
});

describe("planChanges", () => {
  it("separates new, kept and dropped focus areas, ignoring case and spacing", () => {
    expect(planChanges(["First touch", "Scanning"], ["first  touch", "Passing"])).toEqual({
      added: ["Passing"], kept: ["first  touch"], dropped: ["Scanning"],
    });
  });
  it("treats a player with no earlier plan as everything new", () => {
    expect(planChanges(null, ["A"])).toEqual({ added: ["A"], kept: [], dropped: [] });
  });
});
