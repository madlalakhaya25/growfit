import { MAX_SESSION_DRILLS, renderSessionPlanProse, validateProgression, validateSessionPlan } from "../session-plan";

const drill = (over: Record<string, unknown> = {}) => ({
  name: "Pattern play", durationMinutes: 10, ltpdFocus: "Passing", fourCorner: "Technical",
  setup: "20x15m, 6 cones", instructions: "1. Pass. 2. Move.", coachingPoints: "Open body", ...over,
});

describe("validateProgression", () => {
  it("keeps three good drills and the reflection", () => {
    const out = validateProgression({ drills: [drill(), drill({ name: "B" }), drill({ name: "C" })], coachReflection: "What did you see?" });
    expect(out?.drills.map((d) => d.name)).toEqual(["Pattern play", "B", "C"]);
    expect(out?.coachReflection).toBe("What did you see?");
  });
  it("caps at three drills", () => {
    const out = validateProgression({ drills: [drill(), drill(), drill(), drill(), drill()], coachReflection: "" });
    expect(out?.drills).toHaveLength(3);
  });
  it("is null with fewer than two usable drills, so no lonely drill is shown as a progression", () => {
    expect(validateProgression({ drills: [drill()], coachReflection: "" })).toBeNull();
    expect(validateProgression({ drills: [drill(), drill({ name: "" })], coachReflection: "" })).toBeNull();
    expect(validateProgression({ drills: [drill(), drill({ instructions: "  " })], coachReflection: "" })).toBeNull();
  });
  it("is null for anything that is not an object with a drills array", () => {
    expect(validateProgression(null)).toBeNull();
    expect(validateProgression({})).toBeNull();
    expect(validateProgression({ drills: "nope" })).toBeNull();
  });
  it("clamps minutes to a whole number from 1 to 30 and defaults a missing one", () => {
    const out = validateProgression({
      drills: [drill({ durationMinutes: 999 }), drill({ durationMinutes: -4 }), drill({ durationMinutes: "x" })],
      coachReflection: "",
    });
    expect(out?.drills.map((d) => d.durationMinutes)).toEqual([30, 1, 10]);
  });
  it("strips asterisks and bounds field length", () => {
    const out = validateProgression({
      drills: [drill({ name: "**Bold**", instructions: "a".repeat(5000) }), drill()],
      coachReflection: "",
    });
    expect(out?.drills[0].name).toBe("Bold");
    expect(out?.drills[0].instructions.length).toBeLessThanOrEqual(1200);
  });
});

describe("renderSessionPlanProse", () => {
  it("writes the DRILL N: shape the session panel splits on", () => {
    const out = renderSessionPlanProse({ drills: [drill(), drill({ name: "B" })], coachReflection: "Q?" });
    expect(out.split(/(?=DRILL \d+:)/g)).toHaveLength(2);
    expect(out).toContain("DRILL 2: B (10 min)");
    expect(out).toContain("COACH REFLECTION: Q?");
  });
});

describe("validateSessionPlan", () => {
  it("accepts a single drill, which a progression would not", () => {
    expect(validateSessionPlan({ drills: [drill()], coachReflection: "Q?" })?.drills).toHaveLength(1);
    expect(validateProgression({ drills: [drill()], coachReflection: "Q?" })).toBeNull();
  });
  it("keeps up to the cap and no more, and a progression still stops at three", () => {
    const many = Array.from({ length: MAX_SESSION_DRILLS + 3 }, (_, i) => drill({ name: `D${i}` }));
    expect(validateSessionPlan({ drills: many, coachReflection: "" })?.drills).toHaveLength(MAX_SESSION_DRILLS);
    expect(validateProgression({ drills: many, coachReflection: "" })?.drills).toHaveLength(3);
  });
  it("is null with no drills array or only empty drills", () => {
    expect(validateSessionPlan(null)).toBeNull();
    expect(validateSessionPlan({ coachReflection: "x" })).toBeNull();
    expect(validateSessionPlan({ drills: [drill({ name: "", instructions: "" }), "junk", null] })).toBeNull();
  });
});
