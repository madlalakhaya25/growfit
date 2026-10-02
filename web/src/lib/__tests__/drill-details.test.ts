import { sanitiseDrillDetails } from "@/lib/drill-details";

const base = {
  durationMinutes: 15,
  ltpdFocus: "Fundamentals",
  fourCorner: "Technical",
  setup: "20x20m grid",
  instructions: "Play 4v2 and keep the ball.",
  coachingPoints: "Open body shape",
};

describe("sanitiseDrillDetails", () => {
  it("keeps a well-formed plan", () => {
    expect(sanitiseDrillDetails(base)).toEqual(base);
  });

  it("rejects anything that is not a plain object", () => {
    for (const v of [null, undefined, "x", 4, [], [base]]) expect(sanitiseDrillDetails(v)).toBeNull();
  });

  it("does not store an empty shell", () => {
    expect(sanitiseDrillDetails({ durationMinutes: 10 })).toBeNull();
    expect(sanitiseDrillDetails({ instructions: "   " })).toBeNull();
  });

  it("caps text lengths and the duration, and ignores non-string fields", () => {
    const out = sanitiseDrillDetails({
      ...base,
      instructions: "x".repeat(5000),
      setup: "y".repeat(900),
      ltpdFocus: 42,
      durationMinutes: 9999,
    })!;
    expect(out.instructions).toHaveLength(2000);
    expect(out.setup).toHaveLength(500);
    expect(out.ltpdFocus).toBe("");
    expect(out.durationMinutes).toBe(180);
  });

  it("treats a bad duration as unknown (0)", () => {
    expect(sanitiseDrillDetails({ ...base, durationMinutes: "soon" })!.durationMinutes).toBe(0);
    expect(sanitiseDrillDetails({ ...base, durationMinutes: -5 })!.durationMinutes).toBe(0);
  });

  it("drops an invalid diagram but keeps the rest of the plan", () => {
    const out = sanitiseDrillDetails({ ...base, diagram: { pitchId: "nope", tokens: "x" } })!;
    expect(out.diagram).toBeUndefined();
    expect(out.instructions).toBe(base.instructions);
  });

  it("does not copy unknown keys", () => {
    const out = sanitiseDrillDetails({ ...base, evil: "<script>" }) as unknown as Record<string, unknown>;
    expect(out.evil).toBeUndefined();
  });
});
