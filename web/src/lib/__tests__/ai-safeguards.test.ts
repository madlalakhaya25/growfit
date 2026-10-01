import { COACH_SYSTEM, PLAYER_FACING_RULE, APPROVAL_RULE, getLTPDPhase, ltpdPhaseForAge, specialistSystem } from "../ai-safeguards";

describe("LTPD phase", () => {
  it.each([
    [6, "FUNdamentals (U6-U9)"], [9, "FUNdamentals (U6-U9)"],
    [10, "Learning to Train (U10-U12)"], [12, "Learning to Train (U10-U12)"],
    [13, "Training to Train (U13-U15)"], [15, "Training to Train (U13-U15)"],
    [16, "Training to Compete (U16-U18)"], [18, "Training to Compete (U16-U18)"],
    [19, "Training to Win (U19+)"], [30, "Training to Win (U19+)"],
  ])("age %i -> %s", (age, name) => {
    expect(ltpdPhaseForAge(age)).toBe(name);
  });

  it("defaults to the academy's middle band when the age is unknown or nonsense", () => {
    for (const a of [null, undefined, 0, -3, NaN]) expect(ltpdPhaseForAge(a)).toBe("Training to Train (U13-U15)");
  });

  it("getLTPDPhase reads an age-group label and adds the phase's focus", () => {
    expect(getLTPDPhase("U11")).toBe("Learning to Train (U10-U12) — first technical window, high ball contacts, 1v1 mastery");
    expect(getLTPDPhase("U15")).toMatch(/^Training to Train \(U13-U15\) — /);
    expect(getLTPDPhase("Seniors")).toMatch(/^Training to Train \(U13-U15\)/);
  });

  it("agrees with itself: the long form starts with the short form", () => {
    for (const age of [8, 11, 14, 17, 20]) expect(getLTPDPhase(`U${age}`).startsWith(ltpdPhaseForAge(age))).toBe(true);
  });
});

describe("system prompts", () => {
  it("COACH_SYSTEM carries both safeguarding rules and the original grounding", () => {
    expect(COACH_SYSTEM).toContain(APPROVAL_RULE);
    expect(COACH_SYSTEM).toContain(PLAYER_FACING_RULE);
    expect(COACH_SYSTEM).toContain("never invent a player, a rating, a result or a statistic");
    expect(COACH_SYSTEM).toContain("75% per term");
    expect(COACH_SYSTEM).toContain("Never repeat a child's medical details");
  });

  it("the player-facing rule forbids naming a deficit and says where criticism belongs", () => {
    expect(PLAYER_FACING_RULE).toMatch(/never name a weakness/);
    expect(PLAYER_FACING_RULE).toMatch(/only in the fields written for the coach/);
  });

  it("specialistSystem keeps the persona, takes the focus, and is grammatical for plural or singular", () => {
    const a = specialistSystem({ focus: "tactical concepts" });
    expect(a).toContain("UEFA Pro Licence and SAFA Level 4");
    expect(a).toContain("Everything you write about tactical concepts is grounded in");
    expect(a).toContain("Plain text only");
    const b = specialistSystem({ focus: "the opponent", alsoA: "opposition analyst", plainText: "in every field" });
    expect(b).toContain("youth development specialist and opposition analyst.");
    expect(b).toContain("Plain text inside every field");
  });
});
