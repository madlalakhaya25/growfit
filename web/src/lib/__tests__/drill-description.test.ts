import { packDrillDescription, DRILL_DESCRIPTION_CAP } from "@/lib/drill-description";
import type { SessionDrill } from "@/app/actions/session-generator";

const drill = (overrides: Partial<SessionDrill> = {}): SessionDrill => ({
  name: "Passing square",
  durationMinutes: 15,
  ltpdFocus: "First-touch control under pressure",
  fourCorner: "Technical",
  setup: "4 cones, 20x20m grid, groups of 4",
  instructions: "Players pass and move around the square, one touch only.",
  coachingPoints: "Head up before receiving; check shoulder.",
  ...overrides,
});

describe("packDrillDescription", () => {
  it("includes all five fields, under the cap, when everything fits comfortably", () => {
    const out = packDrillDescription(drill());
    expect(out.length).toBeLessThanOrEqual(DRILL_DESCRIPTION_CAP);
    expect(out).toContain("LTPD Focus: First-touch control under pressure");
    expect(out).toContain("4-Corner: Technical");
    expect(out).toContain("Setup: 4 cones, 20x20m grid, groups of 4");
    expect(out).toContain("Instructions: Players pass and move");
    expect(out).toContain("Coaching Points: Head up before receiving; check shoulder.");
  });

  it("truncates instructions first when the combined text exceeds the cap", () => {
    const longInstructions = "Step one. ".repeat(100); // ~1000 chars, way over the cap alone
    const out = packDrillDescription(drill({ instructions: longInstructions }));
    expect(out.length).toBeLessThanOrEqual(DRILL_DESCRIPTION_CAP);
    // The other four fields still appear in full — only instructions gave ground.
    expect(out).toContain("LTPD Focus: First-touch control under pressure");
    expect(out).toContain("Coaching Points: Head up before receiving; check shoulder.");
    expect(out).toContain("…");
    expect(out).not.toContain(longInstructions);
  });

  it("still stays under the cap when every field is individually long", () => {
    const long = "x".repeat(300);
    const out = packDrillDescription({
      name: "Long drill",
      durationMinutes: 20,
      ltpdFocus: long,
      fourCorner: "Tactical",
      setup: long,
      instructions: long,
      coachingPoints: long,
    });
    expect(out.length).toBeLessThanOrEqual(DRILL_DESCRIPTION_CAP);
  });
});
