import {
  BANDS, BAND_LABELS, BAND_DESCRIPTIONS, ageBracket, describeBand, growthBetween, growthLine, isBand, unreviewed,
} from "@/lib/term-review";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";

describe("ageBracket", () => {
  it("maps age groups to the wording they read", () => {
    expect(ageBracket("U9")).toBe("U11");
    expect(ageBracket("U12")).toBe("U11");
    expect(ageBracket("U13")).toBe("U13");
    expect(ageBracket("u14")).toBe("U13");
    expect(ageBracket("U15")).toBe("U15");
    expect(ageBracket("U17")).toBe("U15");
  });
  it("reads an unknown group as U13", () => {
    expect(ageBracket(null)).toBe("U13");
    expect(ageBracket("Seniors")).toBe("U13");
  });
});

describe("band descriptions", () => {
  it("has a distinct description for every category, age group and band", () => {
    for (const c of MILESTONE_CATEGORIES) {
      for (const a of ["U11", "U13", "U15"] as const) {
        const texts = BANDS.map((b) => BAND_DESCRIPTIONS[c][a][b]);
        expect(texts.every((t) => t.length > 20)).toBe(true);
        expect(new Set(texts).size).toBe(4);
      }
    }
  });
  it("picks the wording for the age group", () => {
    expect(describeBand("technical", "U11", 1)).toBe(BAND_DESCRIPTIONS.technical.U11[1]);
    expect(describeBand("technical", "U15", 4)).toBe(BAND_DESCRIPTIONS.technical.U15[4]);
  });
});

describe("growth", () => {
  it("classifies movement", () => {
    expect(growthBetween(null, 2)).toBe("first");
    expect(growthBetween(1, 3)).toBe("up");
    expect(growthBetween(3, 3)).toBe("steady");
    expect(growthBetween(4, 3)).toBe("building");
  });

  it("never shows a score or calls a drop a decline", () => {
    const lines = [
      growthLine("Technical", null, 2),
      growthLine("Technical", 1, 3),
      growthLine("Technical", 3, 3),
      growthLine("Technical", 4, 2),
    ];
    for (const l of lines) {
      expect(l).not.toMatch(/\d/);
      expect(l).not.toMatch(/declin|dropp|worse|down/i);
    }
    expect(lines[1]).toBe("Technical: moved up from Emerging to Secure.");
    expect(lines[3]).toMatch(/still building/);
  });
});

describe("isBand and unreviewed", () => {
  it("accepts only 1-4", () => {
    expect([0, 1, 4, 5, "2", null].map(isBand)).toEqual([false, true, true, false, false, false]);
    expect(BAND_LABELS[3]).toBe("Secure");
  });
  it("lists what is left, in display order", () => {
    expect(unreviewed([{ category: "tactical", band: 2 }], MILESTONE_CATEGORIES)).toEqual([
      "technical", "physical", "mental", "leadership",
    ]);
  });
});
